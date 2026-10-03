import { describe, expect, it } from 'vitest';
import {
  ADVISOR_MODEL,
  AI_ADVISOR_ENV_FLAG,
  MAX_ADVISORIES,
  MAX_ADVISORY_MESSAGE_CHARS,
  buildAdvisorSystemPrompt,
  buildAdvisorUserMessage,
  isAiAdvisorEnabled,
  parseAdvisories,
  requestAdvisories,
  type AdvisoryClient,
} from './ai-advisor';
import { VALID_COPING_CAP_ITEM, VALID_DRAWN_ITEM } from './fixtures';
import type { OrderValidatorItem } from './types';

const ITEMS: OrderValidatorItem[] = [VALID_COPING_CAP_ITEM, VALID_DRAWN_ITEM];

/** A client that answers with exactly what it was given. */
function clientReturning(body: string): AdvisoryClient {
  return { complete: async () => body };
}

/** A client that must never be called. Calling it fails the test, loudly. */
const FORBIDDEN_CLIENT: AdvisoryClient = {
  complete: async () => {
    throw new Error(
      'The Anthropic client was called. With AFS_ORDER_VALIDATOR_AI unset there must be no request at all — not a request that fails, not a request that is ignored.'
    );
  },
};

function captureProblems(): { problems: string[]; onProblem: (message: string) => void } {
  const problems: string[] = [];
  return { problems, onProblem: (message) => problems.push(message) };
}

const ONE_GOOD_ADVISORY = JSON.stringify({
  advisories: [
    {
      itemIndex: 0,
      field: 'height',
      severity: 'warning',
      message: 'A 6 inch face on a 12 inch cap is unusually deep for a parapet — AFS will confirm this is intended.',
    },
  ],
});

describe('isAiAdvisorEnabled: off by default', () => {
  it('is off when the flag is absent', () => {
    expect(
      isAiAdvisorEnabled({}),
      `Expected false with no ${AI_ADVISOR_ENV_FLAG} set. The run's directive is that the AI layer is OFF by default; a default-on advisory layer would make every quote request wait on a model.`
    ).toBe(false);
  });

  it('is on only for the exact string "1"', () => {
    expect(isAiAdvisorEnabled({ AFS_ORDER_VALIDATOR_AI: '1' }), 'Expected true for exactly "1".').toBe(true);
  });

  it('is off for every near miss, so a typo cannot enable it', () => {
    for (const value of ['', '0', 'true', 'TRUE', 'yes', 'on', ' 1', '1 ', '01', '11']) {
      expect(
        isAiAdvisorEnabled({ AFS_ORDER_VALIDATOR_AI: value }),
        `Expected false for ${JSON.stringify(value)}. The check is an exact string comparison, not a truthiness test — "0" and "false" are both truthy strings and would otherwise switch the layer on.`
      ).toBe(false);
    }
  });
});

describe('the prompt', () => {
  it('forbids money and refusals in the instructions it gives the model', () => {
    const prompt = buildAdvisorSystemPrompt();
    expect(
      prompt,
      'Expected the prompt to forbid mentioning money. It is not the enforcement — parseAdvisories drops a currency-bearing message — but a prompt that invites a price and a parser that strips it would produce silence instead of advice.'
    ).toContain('NEVER mention money');
    expect(
      prompt.toUpperCase(),
      'Expected the prompt to tell the model it is advisory, so its messages are written as things to confirm rather than as refusals sitting under a heading that says the customer may continue.'
    ).toContain('ADVISORY');
    expect(
      prompt,
      'Expected the prompt to name the closed field list, so the model has no reason to invent a field name the parser will then drop.'
    ).toContain('profileType, material, gauge, width, height, legA, legB, lengthFt, quantity');
  });

  it('describes each item with its index and its real dimensions', () => {
    const message = buildAdvisorUserMessage(ITEMS);
    expect(message, 'Expected item 0 described.').toContain('item 0:');
    expect(message, 'Expected item 1 described.').toContain('item 1:');
    expect(message, 'Expected the coping cap width in inches.').toContain('widthIn=12');
    expect(
      message,
      'Expected the units stated once at the top. A model handed bare numbers is exactly how a "that looks like millimetres" observation becomes nonsense.'
    ).toContain('inches');
  });

  it('omits fields the customer left blank rather than sending them as null', () => {
    const message = buildAdvisorUserMessage([{ profileType: 'Drip Edge', width: 4 }]);
    expect(
      message,
      `Expected no "null" in the prompt; got "${message}". A blank field is not a measurement of zero, and a model told "legA=null" will comment on it.`
    ).not.toContain('null');
  });

  it('says so plainly when an item has nothing specified', () => {
    expect(
      buildAdvisorUserMessage([{}]),
      'Expected an explicit "(nothing specified)" rather than a dangling "item 0:" the model has to interpret.'
    ).toContain('(nothing specified)');
  });

  it('passes the deterministic findings through as already flagged', () => {
    const message = buildAdvisorUserMessage(ITEMS, ['The smallest width for a Coping Cap is 6".']);
    expect(
      message,
      'Expected the already-flagged list included, so the model neither rediscovers what is on screen nor pads its list by repeating it.'
    ).toContain('The smallest width for a Coping Cap is 6".');
  });

  it('states that nothing is already flagged when nothing is', () => {
    expect(
      buildAdvisorUserMessage(ITEMS),
      'Expected an explicit "(nothing)" — an absent section reads as a truncated prompt.'
    ).toContain('ALREADY_FLAGGED: (nothing)');
  });
});

describe('parseAdvisories: what it keeps', () => {
  it('keeps a well-formed advisory and marks it as coming from the model', () => {
    const found = parseAdvisories(ONE_GOOD_ADVISORY, 2);
    expect(found.length, `Expected one advisory; got ${found.length}.`).toBe(1);
    expect(
      found[0].source,
      'Expected source "ai". A finding that came from a model and claimed to be one of AFS\'s own rules would carry a rule\'s authority with none of its grounding.'
    ).toBe('ai');
    expect(
      found[0].code,
      'Expected the one code reserved for the advisory layer, which deliberately has no rule behind it.'
    ).toBe('OV_AI_ADVISORY');
    expect(found[0].field, 'Expected the field the model named.').toBe('height');
    expect(found[0].itemIndex, 'Expected the item the model named.').toBe(0);
    expect(
      found[0].audience,
      'Expected customer: SPEC section 5 shows these to the customer with an acknowledge option, and they are clearly labelled as an AI review on screen.'
    ).toBe('customer');
  });

  it('clamps "warning" to warn', () => {
    expect(
      parseAdvisories(ONE_GOOD_ADVISORY, 2)[0].severity,
      'Expected warn. The model speaks the spec\'s "warning"; the engine\'s vocabulary is "warn", and one translation point is better than two spellings.'
    ).toBe('warn');
  });

  it('keeps "info" as info', () => {
    const body = JSON.stringify({
      advisories: [{ itemIndex: 0, field: 'gauge', severity: 'info', message: 'Worth knowing about this gauge choice.' }],
    });
    expect(
      parseAdvisories(body, 1)[0].severity,
      'Expected info to survive: the clamp lowers a severity, it never raises one, so a note is not promoted into something the customer must acknowledge.'
    ).toBe('info');
  });

  it('clamps every unknown or escalated severity to warn', () => {
    for (const severity of ['error', 'critical', 'ERROR', 'fatal', 'blocking', 42, null, undefined]) {
      const body = JSON.stringify({
        advisories: [{ itemIndex: 0, field: 'width', severity, message: 'Something the model wants to say.' }],
      });
      const found = parseAdvisories(body, 1);
      expect(found.length, `Expected the entry kept for severity ${JSON.stringify(severity)}.`).toBe(1);
      expect(
        found[0].severity,
        `Expected warn for severity ${JSON.stringify(severity)}; got ${found[0].severity}. A model claiming "error" must not be able to block a fabricable order.`
      ).toBe('warn');
    }
  });

  it('reads the spec section 3 response shape too, clamping it the same way', () => {
    const specShape = JSON.stringify({
      valid: false,
      errors: [{ itemIndex: 0, field: 'legA', severity: 'error', message: 'The model believes these legs are wrong.' }],
      warnings: [{ itemIndex: 0, field: 'width', severity: 'warning', message: 'The model is unsure about this width.' }],
    });
    const found = parseAdvisories(specShape, 1);
    expect(
      found.length,
      `Expected both entries read; got ${found.length}. SPEC section 3 specifies errors/warnings arrays, and a model given a JSON schema does occasionally answer in a neighbouring one — losing every advisory over the array name would be the worse failure.`
    ).toBe(2);
    expect(
      found.map((f) => f.severity),
      'Expected both clamped to warn: the array an entry arrived in is not a severity.'
    ).toEqual(['warn', 'warn']);
  });

  it('tolerates a response wrapped in markdown code fences', () => {
    const fenced = `\`\`\`json\n${ONE_GOOD_ADVISORY}\n\`\`\``;
    expect(
      parseAdvisories(fenced, 2).length,
      'Expected one advisory. Every other AI route in this repository strips fences before parsing, because the models do emit them despite being told not to.'
    ).toBe(1);
  });

  it('tolerates a sentence of preamble before the JSON', () => {
    const chatty = `Here you go:\n\`\`\`json\n${ONE_GOOD_ADVISORY}\n\`\`\`\nHope that helps.`;
    expect(
      parseAdvisories(chatty, 2).length,
      'Expected one advisory. Stripping fences alone is not enough — the commonest real deviation from "JSON only" is a sentence of preamble, and the whole response then fails to parse. Falling back to the outermost braces recovers it.'
    ).toBe(1);
  });
});

describe('parseAdvisories: what it drops, and reports', () => {
  it('drops an advisory naming a field that does not exist', () => {
    const capture = captureProblems();
    const body = JSON.stringify({
      advisories: [{ itemIndex: 0, field: 'thickness', severity: 'warning', message: 'About the thickness.' }],
    });
    expect(
      parseAdvisories(body, 1, capture),
      'Expected []. There is no "thickness" input to put the message under, and guessing a field would put it beneath the wrong box.'
    ).toEqual([]);
    expect(
      capture.problems.length,
      'Expected the drop reported. A silent discard looks exactly like a model with nothing to say, and would hide a broken prompt for a month.'
    ).toBe(1);
  });

  it('drops an advisory pointing at an item that is not in the request', () => {
    const capture = captureProblems();
    for (const itemIndex of [5, -1, 1.5, '0', null, undefined]) {
      const body = JSON.stringify({
        advisories: [{ itemIndex, field: 'width', severity: 'warning', message: 'About some item or other.' }],
      });
      expect(
        parseAdvisories(body, 1, capture),
        `Expected [] for itemIndex ${JSON.stringify(itemIndex)} against a one-item request. An out-of-range index would decorate a row that does not exist, or silently land on row 0 and blame the wrong line.`
      ).toEqual([]);
    }
  });

  it('drops an advisory with an empty or missing message', () => {
    for (const message of ['', '   ', null, undefined, 42]) {
      const body = JSON.stringify({ advisories: [{ itemIndex: 0, field: 'width', severity: 'warning', message }] });
      expect(
        parseAdvisories(body, 1),
        `Expected [] for message ${JSON.stringify(message)}. A marker with no sentence is a warning with no reason.`
      ).toEqual([]);
    }
  });

  it('drops any advisory that reads as money', () => {
    const forbidden = [
      'A heavier gauge costs more but holds the span better.',
      'This adds a $40 surcharge.',
      'The price of copper makes this choice unusual.',
      'That is an extra 500 cents per piece.',
      'Consider aluminium for a lower cost.',
    ];
    for (const message of forbidden) {
      const body = JSON.stringify({ advisories: [{ itemIndex: 0, field: 'gauge', severity: 'warning', message }] });
      expect(
        parseAdvisories(body, 1),
        `Expected [] for "${message}". AFS is an RFQ platform — a customer sees no figure with a currency on it before AFS has issued a formal quote. The prompt forbids this; a prompt is not enforcement.`
      ).toEqual([]);
    }
  });

  it('keeps a message that merely mentions a heavier gauge without pricing it', () => {
    const body = JSON.stringify({
      advisories: [
        {
          itemIndex: 0,
          field: 'gauge',
          severity: 'warning',
          message: 'A heavier gauge holds this span more steadily — AFS will confirm your choice.',
        },
      ],
    });
    expect(
      parseAdvisories(body, 1).length,
      'Expected the advisory kept. The currency guard must not be so broad that honest fabrication advice cannot be given; this is the case that proves it is not just blocking the word "gauge".'
    ).toBe(1);
  });

  it('truncates an over-long message rather than dropping it', () => {
    const body = JSON.stringify({
      advisories: [{ itemIndex: 0, field: 'width', severity: 'warning', message: `${'a'.repeat(5000)}.` }],
    });
    const found = parseAdvisories(body, 1);
    expect(found.length, 'Expected the advisory kept — the observation may be real even if the model rambled.').toBe(1);
    expect(
      found[0].message.length,
      `Expected at most ${MAX_ADVISORY_MESSAGE_CHARS} characters; got ${found[0].message.length}. A 5000-character string in a banner breaks the page layout.`
    ).toBeLessThanOrEqual(MAX_ADVISORY_MESSAGE_CHARS);
  });

  it('caps the number of advisories it will accept', () => {
    const capture = captureProblems();
    const body = JSON.stringify({
      advisories: Array.from({ length: 40 }, (_unused, index) => ({
        itemIndex: 0,
        field: 'width',
        severity: 'warning',
        message: `Observation number ${index} about this width.`,
      })),
    });
    const found = parseAdvisories(body, 1, capture);
    expect(
      found.length,
      `Expected at most ${MAX_ADVISORIES}; got ${found.length}. Forty banners is not advice, and the cap is what stops one odd response burying the deterministic errors the customer actually has to fix.`
    ).toBe(MAX_ADVISORIES);
    expect(capture.problems.length, 'Expected the overflow reported rather than silently truncated.').toBe(1);
  });

  it('returns nothing for a body that is not JSON, and says so', () => {
    const capture = captureProblems();
    expect(
      parseAdvisories('I am afraid I cannot help with that.', 1, capture),
      'Expected []. A cast would have handed this to a page as an object with no properties.'
    ).toEqual([]);
    expect(capture.problems[0], `Expected the problem named; got ${JSON.stringify(capture.problems)}.`).toContain(
      'not JSON'
    );
    expect(
      capture.problems[0],
      'Expected a truncated copy of the real body in the log line. The truncation is what makes it diagnosable — the same reasoning as logVendorShapeProblem.'
    ).toContain('I am afraid');
  });

  it('returns nothing for JSON that is not an object, and distinguishes that from unparseable', () => {
    const capture = captureProblems();
    for (const body of ['[]', '"a string"', '42', 'null', 'true']) {
      expect(parseAdvisories(body, 1, capture), `Expected [] for ${body}.`).toEqual([]);
    }
    expect(capture.problems.length, 'Expected every one reported.').toBe(5);
    for (const problem of capture.problems) {
      expect(
        problem,
        `Expected "not a JSON object", not "not JSON"; got "${problem}". These are different failures — one is a transport or prompt problem, the other is a response shape problem — and the log line is the only thing that will tell whoever reads it which one happened.`
      ).toContain('not a JSON object');
    }
  });

  it('returns nothing for an object with no advisory arrays at all', () => {
    expect(
      parseAdvisories(JSON.stringify({ valid: true }), 1),
      'Expected []. SPEC section 3 has the model answer {"valid": true} with empty arrays when all is well, and that must read as "nothing to say", not as a parse failure.'
    ).toEqual([]);
  });

  it('returns nothing for an empty string, and says so', () => {
    const capture = captureProblems();
    expect(parseAdvisories('', 1, capture), 'Expected [] for an empty response.').toEqual([]);
    expect(capture.problems[0], 'Expected the empty response reported.').toContain('empty response');
  });

  it('skips a non-object entry inside an otherwise good array', () => {
    const capture = captureProblems();
    const body = JSON.stringify({
      advisories: [
        'just a string',
        null,
        { itemIndex: 0, field: 'width', severity: 'warning', message: 'A real observation about the width.' },
      ],
    });
    const found = parseAdvisories(body, 1, capture);
    expect(
      found.length,
      `Expected the one good entry kept; got ${found.length}. One malformed entry must not discard the rest of a useful response.`
    ).toBe(1);
    expect(capture.problems.length, 'Expected the two discards reported in one line.').toBe(1);
  });
});

describe('requestAdvisories: nothing escapes', () => {
  it('asks the model and returns its advisories', async () => {
    const found = await requestAdvisories(ITEMS, clientReturning(ONE_GOOD_ADVISORY));
    expect(found.length, 'Expected the one advisory through the whole path.').toBe(1);
  });

  it('calls the client with the repository-wide model', async () => {
    let seenModel = '';
    const client: AdvisoryClient = {
      complete: async (request) => {
        seenModel = request.model;
        return ONE_GOOD_ADVISORY;
      },
    };
    await requestAdvisories(ITEMS, client);
    expect(
      seenModel,
      `Expected ${ADVISOR_MODEL}, the model every other AI call in this repository uses; got "${seenModel}".`
    ).toBe(ADVISOR_MODEL);
  });

  it('makes no request at all for an empty request', async () => {
    expect(
      await requestAdvisories([], FORBIDDEN_CLIENT),
      'Expected [] without calling the model. There is nothing to review, and a request that asks about no items spends a token budget to be told so.'
    ).toEqual([]);
  });

  it('returns nothing when the client rejects', async () => {
    const capture = captureProblems();
    const client: AdvisoryClient = {
      complete: async () => {
        throw new Error('503 upstream unavailable');
      },
    };
    expect(
      await requestAdvisories(ITEMS, client, capture),
      'Expected []. The deterministic result is complete on its own, so an advisory outage must never become a quote-request outage.'
    ).toEqual([]);
    expect(capture.problems[0], `Expected the failure reported; got ${JSON.stringify(capture.problems)}.`).toContain(
      '503 upstream unavailable'
    );
  });

  it('returns nothing when the client never answers in time', async () => {
    const capture = captureProblems();
    const client: AdvisoryClient = {
      complete: () => new Promise((resolve) => setTimeout(() => resolve(ONE_GOOD_ADVISORY), 200)),
    };
    const found = await requestAdvisories(ITEMS, client, { ...capture, timeoutMs: 20 });
    expect(
      found,
      'Expected []. SPEC section 6 sets an 8 second ceiling and says to fall through; a customer pressing Next does not wait on a stalled model.'
    ).toEqual([]);
    expect(capture.problems[0], 'Expected the timeout reported, not swallowed.').toContain('timed out');
  });

  it('returns nothing when the client resolves with something that is not a string', async () => {
    const capture = captureProblems();
    const client = { complete: async () => ({ unexpected: true }) } as unknown as AdvisoryClient;
    expect(
      await requestAdvisories(ITEMS, client, capture),
      'Expected []. The adapter is meant to return the model\'s text; a changed SDK shape must degrade, not crash a route.'
    ).toEqual([]);
    expect(capture.problems[0], 'Expected the wrong type named in the report.').toContain('rather than a string');
  });

  it('never throws, whatever the client does', async () => {
    const clients: AdvisoryClient[] = [
      { complete: async () => 'not json' },
      { complete: async () => '' },
      {
        complete: async () => {
          throw new Error('boom');
        },
      },
      { complete: () => Promise.reject(new Error('rejected')) },
      { complete: () => Promise.reject('a string, not an Error') as Promise<string> },
    ];
    for (const client of clients) {
      const capture = captureProblems();
      await expect(
        requestAdvisories(ITEMS, client, capture),
        'Expected a resolved empty array rather than a rejection. An advisory layer that can throw is an advisory layer that can take down the validate route.'
      ).resolves.toEqual([]);
    }
  });

  it('validates the item index against the real request length', async () => {
    const body = JSON.stringify({
      advisories: [{ itemIndex: 1, field: 'width', severity: 'warning', message: 'About the second item.' }],
    });
    expect(
      (await requestAdvisories([VALID_COPING_CAP_ITEM], clientReturning(body))).length,
      'Expected [] for a one-item request: requestAdvisories passes its own item count to the parser rather than trusting the model to stay in range.'
    ).toBe(0);
    expect(
      (await requestAdvisories(ITEMS, clientReturning(body))).length,
      'Expected the same advisory kept for a two-item request, proving the bound is the real count and not a constant.'
    ).toBe(1);
  });
});
