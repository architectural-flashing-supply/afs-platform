import { JOB_STAGES, type JobStage } from '@/lib/data/job-stage';
import type { Workbench, WorkbenchCard } from '@/lib/data/workbench';
import { V7_COLORS } from '@/lib/fixtures/command-center-v7';
import type { ProfileSource } from '@/lib/data/v8-profile-source';
import { JOB_HANDOFF_PARAM } from '@/lib/flashdraft/job-handoff';

/**
 * THE WORKBENCH, AS MOCKUP B DRAWS IT — a stage strip over ONE table.
 *
 * `docs/design/command-center-v8/Workbench_B-stage-strip-table.html`, frozen
 * and hash-verified. The contract wins on layout, labels, order and colour;
 * the live app wins where it supplies real data or real behaviour the mockup
 * only mimes (CLAUDE.md rule #33's carve-out).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM THE v7 WORKBENCH, AND WHY THE VIEW MODEL IS NEW.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v7's Workbench is five KANBAN LANES. Mockup B is a stage STRIP that filters
 * ONE TABLE. Those are not the same screen with different CSS — a lane board
 * groups rows and a filtered table orders them, so the data they need differs.
 * Rather than bend `V7WorkbenchView` into both shapes and have each half
 * constrain the other, this is its own model, built from the same
 * `lib/data/workbench.ts` read. Nothing new is queried.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE FIFTH STAGE IS CALLED "Deliver" HERE AND `done` IN THE DATABASE.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The contract's strip reads New / Quoted / Approved / In the shop / Deliver,
 * and its rows in that stage carry "Schedule delivery" and "Track delivery".
 * The live ladder's fifth rung is `done`, whose sub-label is "Delivered" and
 * whose card action really is `schedule-delivery`. Same rung, and the contract
 * names it for the work still outstanding rather than for the step just
 * finished — which is the more useful label on a board of things to do. The
 * KEY stays `done`; only the word changes, so nothing in the database, the
 * stage ladder or the rush rules is touched.
 */

export const V8_STAGE_LABELS: Record<JobStage, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  // See the header: the contract's own word for the `done` rung.
  done: 'Deliver',
};

/** v7/v8's `.pill` modifier per stage, taken from the contract's own rows. */
const STAGE_PILL: Record<JobStage, string> = {
  new: 'b',
  quoted: 'n',
  approved: 'g',
  shop: 'n',
  done: 'a',
};

/** The contract's `.btn` tone per action kind. */
const ACTION_TONE: Record<string, string> = {
  'start-quote': 'b',
  'send-to-machine': 'g',
  'retry-send': 'g',
  'schedule-delivery': 'a',
};

export interface V8WorkbenchRow {
  key: string;
  /** Mockup B's bold first line: who it is for. */
  customer: string;
  /** Its muted second line: "J-2042 · Field app photo". */
  jobLine: string;
  /** The Profile column's bold line. */
  profile: string;
  /** Its muted second line — the material and gauge. */
  profileSpec: string;
  /** The Color/qty column: a swatch, a colour name, and the quantity line. */
  colorName: string;
  colorHex: string;
  qtyLine: string;
  stage: JobStage;
  stageLabel: string;
  pillTone: string;
  /** The muted "38 min" under the pill. */
  when: string;
  action: { label: string; tone: string; kind: string } | null;
  href: string;
  flashDraftHref: string;
  profileSource: ProfileSource | null;
  isRush: boolean;
}

export interface V8Stage {
  key: JobStage | 'all';
  label: string;
  count: number;
}

export interface V8Need {
  tone: 'b' | 'g' | 'a' | 'n';
  count: number;
  text: string;
  /** Where the button goes. `null` when there is nowhere honest to send anybody. */
  href: string | null;
}

export interface V8WorkbenchView {
  greeting: string;
  stages: V8Stage[];
  needs: V8Need[];
  rows: V8WorkbenchRow[];
  /**
   * The contract's "✉ Inbox · 7 new" button. `null` when there is no mail
   * connection behind it, which is the live truth — the button then says so
   * rather than showing a number nobody can click through to.
   */
  inboxNewCount: number | null;
  /** Reid's profile rule 1d — jobs with no image of any kind, as work. */
  needsDrawing: { key: string; title: string; sub: string; href: string; flashDraftHref: string }[];
  footNotes: string[];
}

/**
 * v7's colour library, matched loosely on the colour word.
 *
 * NO GUESSING BEYOND A NAMED COLOUR — the same rule and the same fallback grey
 * `from-live.ts` already applies. A wrong swatch on a board that feeds a
 * bending machine is worse than a neutral one.
 */
function swatch(spec: string): { name: string; hex: string } {
  if (!spec) return { name: '', hex: '#999999' };
  const exact = V7_COLORS[spec];
  if (exact) return { name: exact[0], hex: exact[1] };
  const lower = spec.toLowerCase();
  for (const [key, val] of Object.entries(V7_COLORS)) {
    if (lower.includes(val[0].toLowerCase()) || lower.includes(key.toLowerCase())) {
      return { name: val[0], hex: val[1] };
    }
  }
  return { name: '', hex: '#999999' };
}

/**
 * Split "Drip edge × 40" back into the profile name and the quantity.
 *
 * `itemLine` is already assembled by `lib/data/workbench.ts` for v7's card, and
 * mockup B wants those two facts in two different COLUMNS. Splitting the
 * string it already built beats adding a second description routine that could
 * disagree with the first about what an item is called.
 */
function splitItem(itemLine: string): { profile: string; qty: string } {
  const at = itemLine.lastIndexOf(' × ');
  if (at < 0) return { profile: itemLine, qty: '' };
  return { profile: itemLine.slice(0, at), qty: itemLine.slice(at + 3) };
}

export function buildV8Workbench(wb: Workbench, deliveriesToSchedule: number): V8WorkbenchView {
  const rows: V8WorkbenchRow[] = [];
  const counts = new Map<JobStage, number>(JOB_STAGES.map((s) => [s, 0]));

  for (const lane of wb.lanes) {
    counts.set(lane.key, lane.cards.length);
    for (const card of lane.cards) rows.push(toRow(card, lane.key));
  }

  // NEWEST ARRIVAL FIRST, across the whole table — mockup B is one list, so
  // something has to order it. CLAUDE.md rule #15: rush pins to the top of the
  // SHOP QUEUES ONLY, and the Workbench is not one, so a rush job here is
  // ordered by arrival like everything else and rush changes nothing but the
  // badge. `when` already carries the age, so the order is visible.
  rows.sort((a, b) => a.when.localeCompare(b.when));

  const stages: V8Stage[] = [
    { key: 'all', label: 'All jobs', count: rows.length },
    ...JOB_STAGES.map((key) => ({ key, label: V8_STAGE_LABELS[key], count: counts.get(key) ?? 0 })),
  ];

  const approvals = counts.get('approved') ?? 0;
  const needs: V8Need[] = [
    {
      tone: 'b',
      count: counts.get('new') ?? 0,
      text: (counts.get('new') ?? 0) === 1 ? 'job to quote' : 'jobs to quote',
      href: null,
    },
    {
      tone: 'g',
      count: approvals,
      text: approvals === 1 ? 'approved · send to machine' : 'approved · send to machine',
      href: null,
    },
    {
      tone: 'a',
      count: deliveriesToSchedule,
      text: deliveriesToSchedule === 1 ? 'delivery to schedule' : 'deliveries to schedule',
      href: '/admin/deliveries',
    },
    // THE CONTRACT'S FOURTH BUTTON IS "3 emails need a reply". There is no mail
    // connection, so a number here would be invented. It says what is true.
    { tone: 'n', count: 0, text: 'email not connected yet', href: '/admin/email-intake' },
  ];

  const needsDrawing = rows
    .filter((r) => r.profileSource?.kind === 'none')
    .map((r) => ({
      key: r.key,
      title: r.customer,
      sub: `${r.profile} · ${r.jobLine}`,
      href: r.href,
      flashDraftHref: r.flashDraftHref,
    }));

  const footNotes = ['Done jobs leave the board after 14 days. Search still finds them.'];
  if (wb.archivedFromDone > 0) {
    footNotes.push(
      wb.archivedFromDone === 1
        ? '1 finished job has left the board.'
        : `${wb.archivedFromDone} finished jobs have left the board.`,
    );
  }

  return {
    greeting: wb.summary.greeting,
    stages,
    needs,
    rows,
    inboxNewCount: null,
    needsDrawing,
    footNotes,
  };
}

function toRow(card: WorkbenchCard, stage: JobStage): V8WorkbenchRow {
  const { profile, qty } = splitItem(card.itemLine);
  const sw = swatch(card.specLine);
  return {
    key: card.id,
    customer: card.customer,
    jobLine: `${card.requestNumber} · ${card.sourceLabel}`,
    profile: profile || 'Not specified',
    profileSpec: card.specLine,
    colorName: sw.name,
    colorHex: sw.hex,
    qtyLine: qty,
    stage,
    stageLabel: V8_STAGE_LABELS[stage],
    pillTone: STAGE_PILL[stage],
    when: card.meta,
    action: card.action
      ? { label: card.action.label, tone: ACTION_TONE[card.action.kind] ?? 'o', kind: card.action.kind }
      : null,
    href: `/admin/command-center/job/${card.id}`,
    flashDraftHref: `/studio/draft?${JOB_HANDOFF_PARAM}=${encodeURIComponent(card.id)}`,
    profileSource: card.profileSource,
    isRush: card.isRush,
  };
}
