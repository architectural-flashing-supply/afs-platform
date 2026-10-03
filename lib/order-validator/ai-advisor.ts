/**
 * THE OPTIONAL ADVISORY LAYER. Off by default, advisory only, and it cannot
 * throw.
 *
 * SPEC_AI_ORDER_VALIDATOR.md section 3 describes a second validation layer that asks
 * Claude whether a set of dimensions is physically possible, and section 5 has its
 * errors BLOCK the customer from advancing. This build keeps the first half and
 * deliberately refuses the second:
 *
 *   A MODEL DOES NOT GET A VETO. On a platform where the next button along
 *   reaches a physical Thalmann DS2801, refusing a fabricable order costs AFS
 *   the job just as surely as missing an impossible one costs them a ruined
 *   sheet — and unlike the deterministic rules, nothing here can be traced back
 *   to a seeded range or a sheet dimension. So every finding this module
 *   produces is clamped to `warn` or `info` by `withAdvisories`
 *   (lib/order-validator/validate.ts), and `blocked` is computed from
 *   deterministic errors alone.
 *
 * THREE PROPERTIES THAT MATTER MORE THAN THE FEATURE:
 *
 *   1. OFF UNLESS ASKED. `isAiAdvisorEnabled` wants the exact string '1' in
 *      AFS_ORDER_VALIDATOR_AI, so a typo cannot switch it on. With the flag off
 *      nothing here is called and no request is made.
 *   2. NO SDK IMPORT. The client is injected, so a unit test needs no network,
 *      no API key and no mock of the Anthropic module. The one adapter that
 *      binds this to the real SDK lives in
 *      lib/order-validator/anthropic-advisor-client.ts, which only the API route
 *      imports — the key never reaches a client bundle (CLAUDE.md rule #5).
 *   3. EVERY RESPONSE IS PARSED, NEVER CAST. The same principle as
 *      lib/integrations/pathfinder-response.ts (CLAUDE.md rule #32): a cast
 *      asserts nothing at runtime, so a renamed field or a 200 carrying prose
 *      would reach a component as a crash or as a row rendered "undefined".
 *      Here it would reach a CUSTOMER as advice, which is worse.
 */

import {
  isValidationField,
  type OrderValidatorItem,
  type ValidationFinding,
  type ValidationSeverity,
} from './types';

/** The exact environment variable, and the exact value that opens it. */
export const AI_ADVISOR_ENV_FLAG = 'AFS_ORDER_VALIDATOR_AI';
export const AI_ADVISOR_ENV_VALUE = '1';

/** Every AI call in this repository uses this model. */
export const ADVISOR_MODEL = 'claude-sonnet-4-6';

/** SPEC section 6: "Timeout: 8 seconds max — fall through to valid if API slow." */
export const ADVISOR_TIMEOUT_MS = 8000;

/** Enough for a real observation per line item on a normal request, and no more. */
export const MAX_ADVISORIES = 6;

/** A banner, not an essay. Anything longer is truncated rather than dropped. */
export const MAX_ADVISORY_MESSAGE_CHARS = 400;

export const ADVISOR_MAX_TOKENS = 900;

/**
 * Not "truthy". The exact string, checked against an explicit environment so a
 * test can exercise it without mutating the process.
 */
export function isAiAdvisorEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[AI_ADVISOR_ENV_FLAG] === AI_ADVISOR_ENV_VALUE;
}

/**
 * What the advisor needs of a model, and nothing more. One method, strings in
 * and a string out — so the mock in the test is three lines and the real
 * adapter is ten.
 */
export interface AdvisoryClient {
  complete(request: { model: string; maxTokens: number; system: string; user: string }): Promise<string>;
}

export interface AdvisoryOptions {
  timeoutMs?: number;
  /**
   * Where a shape or transport problem is reported. One line, server-side.
   * Defaults to `console.error`; a test passes a capture so the suite stays
   * quiet and can assert that a problem really was reported rather than
   * swallowed.
   */
  onProblem?: (message: string) => void;
}

/**
 * ONE SERVER LINE PER PROBLEM, with a truncated copy of the real body.
 *
 * The truncation is what makes it diagnosable — the same reasoning as
 * `logVendorShapeProblem` in lib/integrations/pathfinder-response.ts. A silent
 * `catch {}` here would mean an advisory layer that had been broken for a month
 * and looked exactly like one with nothing to say.
 */
function reportProblem(options: AdvisoryOptions, problem: string, body?: string): void {
  const report = options.onProblem ?? ((message: string) => console.error(message));
  const tail = body === undefined ? '' : ` body="${body.slice(0, 300)}"`;
  report(`[Order Validator AI] ${problem}${tail}`);
}

/**
 * The system prompt.
 *
 * ASKS FOR ADVISORIES, NOT ERRORS, and that is the consequence of the decision
 * above rather than a wording preference: a prompt that invites a refusal and
 * then has it silently demoted to a warning would produce messages written as
 * refusals ("this cannot be fabricated") sitting under a heading that says the
 * customer may continue. The two have to agree.
 */
export function buildAdvisorSystemPrompt(): string {
  return `You are a sheet metal fabrication reviewer for AFS Architectural Flashing Supply, a custom architectural flashing fabricator.

You are given the line items of a customer's quote request. AFS has ALREADY run its own deterministic checks — dimension ranges, minimum flange and hem lengths, bend counts, self-intersecting geometry, and whether the flat blank fits across a sheet. Your job is the remaining judgement: point out anything about these dimensions that an experienced fabricator would query before cutting metal.

WHAT TO LOOK FOR:
- A combination that is dimensionally legal but practically odd for the profile type named.
- A proportion that suggests the customer swapped two fields (a height larger than the overall width on a profile where that cannot be right).
- A material or gauge choice that an experienced fabricator would question for the application.
- A dimension that looks like a unit mistake (a value that would make sense in millimetres but not in inches).

RULES, ALL OF THEM BINDING:
- You are ADVISORY. Nothing you return blocks the customer. Write every message as something to confirm, never as a refusal.
- NEVER mention money. No price, no cost, no surcharge, no "extra sheet", no comparison of one choice being cheaper than another. AFS quotes are issued by an estimator; a customer sees no figures before that.
- Do NOT repeat anything in ALREADY_FLAGGED below. It is already on screen.
- If you have nothing worth saying, return an empty list. An invented observation is worse than silence.
- Say nothing you cannot ground in the numbers you were given. Do not guess at a drawing you cannot see.
- Plain English for a contractor. No jargon the customer would have to look up.

Return JSON only — no prose, no markdown, no code fences:
{
  "advisories": [
    {
      "itemIndex": 0,
      "field": "width",
      "severity": "warning",
      "message": "One or two sentences, written as something for AFS to confirm with you."
    }
  ]
}

"field" must be exactly one of: profileType, material, gauge, width, height, legA, legB, lengthFt, quantity.
"severity" must be "warning" (worth confirming) or "info" (worth knowing).
Return {"advisories": []} when there is nothing to say.`;
}

function describeItemForPrompt(item: OrderValidatorItem, index: number): string {
  const parts: string[] = [];
  const push = (label: string, value: unknown): void => {
    if (value === null || value === undefined || value === '') return;
    parts.push(`${label}=${String(value)}`);
  };
  push('profile', item.profileType);
  push('material', item.material);
  push('gauge', item.gauge);
  push('widthIn', item.width);
  push('heightIn', item.height);
  push('legAIn', item.legA);
  push('legBIn', item.legB);
  push('lengthFt', item.lengthFt);
  push('quantity', item.quantity);
  if (Array.isArray(item.points) && item.points.length >= 2) {
    parts.push(`drawnLegs=${item.points.length - 1}`);
  }
  return `item ${index}: ${parts.length > 0 ? parts.join(' ') : '(nothing specified)'}`;
}

/**
 * The user message: the items as plain key/value lines, plus what the
 * deterministic pass has already told the customer, so the model is not asked to
 * rediscover it and cannot pad the list by repeating it.
 */
export function buildAdvisorUserMessage(
  items: readonly OrderValidatorItem[],
  alreadyFlagged: readonly string[] = []
): string {
  const lines = items.map(describeItemForPrompt);
  const flagged =
    alreadyFlagged.length === 0
      ? 'ALREADY_FLAGGED: (nothing)'
      : `ALREADY_FLAGGED:\n${alreadyFlagged.map((message) => `- ${message}`).join('\n')}`;
  return `All dimensions are in inches unless the key says otherwise.\n\n${lines.join('\n')}\n\n${flagged}`;
}

/** Anything that reads as money. Mirrors lib/order-validator/scope.test.ts. */
const CURRENCY_PATTERN = /\$|\bUSD\b|\bcents?\b|\bdollars?\b|\bpric(e|es|ed|ing)\b|\bcosts?\b|\bsurcharge\b|\bupcharge\b/i;

function clampSeverity(raw: unknown): ValidationSeverity {
  return raw === 'info' ? 'info' : 'warn';
}

function truncate(message: string): string {
  if (message.length <= MAX_ADVISORY_MESSAGE_CHARS) return message;
  return `${message.slice(0, MAX_ADVISORY_MESSAGE_CHARS - 1).trimEnd()}…`;
}

function stripCodeFences(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/**
 * Parses the response, falling back to the outermost `{...}` inside it.
 *
 * STRIPPING FENCES IS NOT ENOUGH, and this is the one place this module does
 * more than the other AI routes in the repository rather than less. They all do
 * `text.replace(/```json|```/g, '')` and parse the rest, which still fails on
 * the commonest real deviation: a model that obeys "JSON only" except for a
 * sentence of preamble ("Here you go:"). Slicing from the first brace to the
 * last recovers that without loosening anything else — a body with no object in
 * it at all still fails, and a body that is valid JSON of the WRONG KIND (`[]`,
 * `42`, a bare string) still parses on the first attempt and is then rejected by
 * the object check, so it is reported as the wrong shape rather than as
 * unparseable. The two failures are different and the log line should say which.
 */
function parseJsonBody(cleaned: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    // Fall through to the brace scan.
  }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last <= first) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(cleaned.slice(first, last + 1)) };
  } catch {
    return { ok: false };
  }
}

/**
 * Collects the advisory arrays out of a parsed body.
 *
 * Accepts `advisories` (what the prompt asks for) and ALSO `warnings` and
 * `errors` — the shape SPEC section 3 specifies. Both are read because a model given a
 * JSON schema does occasionally answer in a neighbouring one, and the cost of
 * tolerating it is five lines against losing every advisory in the response. An
 * entry arriving under `errors` is still clamped like every other: the array it
 * came in is not a severity.
 */
function collectRawEntries(parsed: Record<string, unknown>): unknown[] {
  const entries: unknown[] = [];
  for (const key of ['advisories', 'warnings', 'errors']) {
    const value = parsed[key];
    if (Array.isArray(value)) entries.push(...value);
  }
  return entries;
}

/**
 * Turns a model response into findings, discarding anything it cannot vouch for.
 *
 * WHAT IS DROPPED, AND WHY EACH ONE IS DROPPED RATHER THAN REPAIRED:
 *   - an unknown `field`: there is no input to point at, and guessing one would
 *     put a message under the wrong box.
 *   - an `itemIndex` outside the request: the finding would decorate a row that
 *     does not exist, or silently land on row 0.
 *   - an empty message: a marker with no sentence is a refusal with no reason.
 *   - a message that reads as money: the prompt forbids it, and a prompt is not
 *     enforcement (CLAUDE.md, BUSINESS MODEL).
 * Everything kept is clamped to warn/info, truncated, and marked `source: 'ai'`
 * so no surface can mistake it for one of AFS's own rules.
 */
export function parseAdvisories(
  raw: string,
  itemCount: number,
  options: AdvisoryOptions = {}
): ValidationFinding[] {
  const cleaned = stripCodeFences(raw);
  if (cleaned === '') {
    reportProblem(options, 'empty response');
    return [];
  }

  const body = parseJsonBody(cleaned);
  if (!body.ok) {
    reportProblem(options, 'response was not JSON', cleaned);
    return [];
  }

  const parsed = body.value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    reportProblem(options, 'response was not a JSON object', cleaned);
    return [];
  }

  const rawEntries = collectRawEntries(parsed as Record<string, unknown>);
  const kept: ValidationFinding[] = [];
  let dropped = 0;

  for (const entry of rawEntries) {
    if (kept.length >= MAX_ADVISORIES) {
      dropped += 1;
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      dropped += 1;
      continue;
    }
    const candidate = entry as Record<string, unknown>;

    if (!isValidationField(candidate.field)) {
      dropped += 1;
      continue;
    }
    const itemIndex = candidate.itemIndex;
    if (typeof itemIndex !== 'number' || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= itemCount) {
      dropped += 1;
      continue;
    }
    const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
    if (message === '') {
      dropped += 1;
      continue;
    }
    if (CURRENCY_PATTERN.test(message)) {
      dropped += 1;
      continue;
    }

    kept.push({
      code: 'OV_AI_ADVISORY',
      severity: clampSeverity(candidate.severity),
      field: candidate.field,
      message: truncate(message),
      itemIndex,
      audience: 'customer',
      source: 'ai',
    });
  }

  if (dropped > 0) {
    reportProblem(options, `discarded ${dropped} unusable advisory entr${dropped === 1 ? 'y' : 'ies'}`, cleaned);
  }

  return kept;
}

/**
 * Races a promise against a timer, and ALWAYS clears the timer.
 *
 * A dangling timer would keep a serverless invocation alive past its answer and
 * hold a vitest worker open after the test that created it had passed.
 */
async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Ask the model for advisories. Returns `[]` for every failure there is.
 *
 * NOTHING ESCAPES. A rejected promise, a timeout, a non-JSON body, a body of the
 * wrong shape, a model inventing a field name — all of them resolve to no
 * advisories and one server line. SPEC section 6 says "fall through to valid if API
 * slow"; this applies that posture to every failure mode rather than to latency
 * alone, because the deterministic result is complete on its own and an advisory
 * outage must never become a quote-request outage.
 */
export async function requestAdvisories(
  items: readonly OrderValidatorItem[],
  client: AdvisoryClient,
  options: AdvisoryOptions = {},
  alreadyFlagged: readonly string[] = []
): Promise<ValidationFinding[]> {
  if (items.length === 0) return [];

  const timeoutMs = options.timeoutMs ?? ADVISOR_TIMEOUT_MS;
  try {
    const raw = await withTimeout(
      client.complete({
        model: ADVISOR_MODEL,
        maxTokens: ADVISOR_MAX_TOKENS,
        system: buildAdvisorSystemPrompt(),
        user: buildAdvisorUserMessage(items, alreadyFlagged),
      }),
      timeoutMs
    );
    if (typeof raw !== 'string') {
      reportProblem(options, `client returned ${typeof raw} rather than a string`);
      return [];
    }
    return parseAdvisories(raw, items.length, options);
  } catch (error) {
    reportProblem(options, `request failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
