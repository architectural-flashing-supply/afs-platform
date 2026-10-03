import { test, expect } from '@playwright/test';

/**
 * AUTO MATERIAL CALCULATOR — SPEC_AUTO_MATERIAL_CALCULATOR.md, item ovn-03.
 *
 * TWO THINGS THIS SPEC PROVES, AND NEITHER IS "the section looks right".
 *
 * 1. THE GATE IS OFF, AND OFF MEANS INVISIBLE. /quote is a live page taking real
 *    RFQs, so the whole point of the feature flag is that Step 2 and Step 3 render
 *    exactly what they rendered before this item. The flag is read at BUILD time
 *    (NEXT_PUBLIC_*, inlined by Next.js), so a test cannot flip it at runtime —
 *    which is also why there is no gate-ON test here. Confirming the section's
 *    appearance with the gate on is a human browser check, recorded as UNVERIFIED.
 *
 * 2. THE API CONTRACT. POST /api/calculator/materials is exercised directly through
 *    request.post, which needs no gate and no session — the route is public,
 *    matching /api/recommendations/cross-sell on the same page.
 *
 * Both halves need a running server (PLAYWRIGHT_BASE_URL or localhost:3000) and
 * neither needs credentials: nothing here signs in and nothing here submits a quote
 * request, so unlike quote-request.spec.ts this is not gated on E2E_TEST_EMAIL.
 */

/** 10 ft x 10 pieces = 100 LF raw, which the spec's §2.1 example bills at 110 LF. */
const TEN_BY_TEN = { lengthFt: 10, pieces: 10 };

test.describe('Auto Material Calculator — the gate is off and Step 3 is unchanged', () => {
  // Symmetric with the gate-on block below. The flag is inlined at BUILD time, so
  // whichever build this spec is pointed at, one of the two blocks runs and the other
  // skips — and neither can quietly pass against the wrong build.
  test.skip(
    process.env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR === '1',
    'NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR is 1 — this build has the section compiled IN.'
  );

  test('Step 3 renders no calculator section while the flag is unset', async ({ page }) => {
    // ARRANGE — walk to Step 3 with quantities filled in, so the ONLY reason the
    // section could be absent is the gate.
    await page.goto('/quote');
    await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#lengthFt').fill('10');
    await page.locator('#quantity').fill('10');

    // ASSERT (Step 2) — the two panels that were already shipped are still there.
    // If either of these disappears, moving §2.1 into lib/material-calculator/ broke
    // a live screen.
    await expect(
      page.getByText('Auto Material Calculator', { exact: true }),
      'WasteFactorDisplay must still render its "Auto Material Calculator" heading in ' +
        'Step 2. Retargeting its import to @/lib/material-calculator must not have ' +
        'changed what it renders.'
    ).toBeVisible();
    // TrimLengthOptimizerSection is deliberately NOT asserted visible here. It hides
    // whenever the profile has no standard stock length, and `product_profiles` is
    // RLS-gated to authenticated users (migration 001's authenticated_read_profiles:
    // `auth.uid() IS NOT NULL AND is_active = true`). This spec runs as a guest, so
    // getProfileStockLengths returns [] and the panel correctly renders nothing —
    // measured live, not assumed. That it never appears for a guest at all is a
    // pre-existing product gap reported with this item, not something to pin here.
    //
    // What IS pinned: this item extracted stockPiecesNeeded out of optimizeTrimLength,
    // so that function's arithmetic must be unchanged. The API contract test below
    // asserts the 11-piece cut list it produces, which is the same code path.

    // ACT — on to Step 3.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Project Details' })).toBeVisible();

    // ASSERT — the new section is absent. Located by its accordion heading's id, which
    // only MaterialCalculatorSection sets, so this cannot be confused with Step 2's
    // identically-worded WasteFactorDisplay heading.
    await expect(
      page.locator('#material-calculator-heading'),
      'With NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR unset, Step 3 must contain no ' +
        'MaterialCalculatorSection at all. A section that renders a disabled or empty ' +
        'shell is not an off gate.'
    ).toHaveCount(0);

    // And nothing the section would have rendered leaked in either.
    await expect(
      page.getByText('Required with this order'),
      'The §3 accessory heading must not appear in Step 3 while the gate is off.'
    ).toHaveCount(0);
    await expect(
      page.getByText('Total ordered'),
      'The §3 billed-quantity row must not appear in Step 3 while the gate is off — ' +
        'Step 2 says "Total billed quantity", which is a different string.'
    ).toHaveCount(0);
  });

  test('no dollar amount appears anywhere in Step 3', async ({ page }) => {
    // ARRANGE — CLAUDE.md rule #1. The calculator computes quantities only, so
    // neither it nor the step it sits in may show a price.
    await page.goto('/quote');
    await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#lengthFt').fill('10');
    await page.locator('#quantity').fill('10');
    await page.getByRole('button', { name: 'Next' }).click();

    // ACT / ASSERT
    await expect(
      page.getByText(/\$[\d,]+(\.\d{2})?/),
      'AFS is an RFQ platform: the customer sees no dollar amount before AFS issues ' +
        'the formal quote. Not in the calculator, not anywhere on the step it sits in.'
    ).toHaveCount(0);
  });
});

/**
 * REGRESSION COVER FOR THE PAGE THIS ITEM EDITED.
 *
 * app/quote/page.tsx gained an import, a useState, a gated render and one entry in
 * the `notes` array. tests/e2e/quote-request.spec.ts covers the submit path but
 * SUBMITS A REAL QUOTE REQUEST, which an unattended run must not do — so this walks
 * all four steps and reads the review screen without pressing Submit.
 */
test.describe('the quote wizard still works end to end, without submitting', () => {
  test('walks all four steps and reaches the review screen', async ({ page }) => {
    // ARRANGE / ACT
    await page.goto('/quote');
    await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#lengthFt').fill('10');
    await page.locator('#quantity').fill('10');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#projectName').fill('ovn-03 render check');
    await page.locator('#jobsiteAddress').fill('123 Test St, Austin, TX 78701');
    await page.getByRole('button', { name: 'Next' }).click();

    // ASSERT — Step 4 renders, so none of this item's edits to the page broke the
    // wizard's navigation or its review view. Nothing is submitted.
    await expect(
      page.getByRole('heading', { name: 'Review Your Request' }),
      'Step 4 must still render. If this fails, adding MaterialCalculatorSection or the ' +
        'calculatorAccessories state broke the wizard.'
    ).toBeVisible();
    await expect(
      page.getByText(/\$[\d,]+(\.\d{2})?/),
      'CLAUDE.md rule #1: no dollar amount on the review screen either.'
    ).toHaveCount(0);
  });
});

/**
 * THE GATE-ON CHECK. Skips unless the build it is running against really has
 * NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR=1 — the flag is inlined at BUILD time, so a
 * gate-off build cannot be made to show the section and this spec must not pretend
 * otherwise. To run it:
 *
 *   NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR=1 pnpm build
 *   NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR=1 PORT=3100 pnpm start
 *   NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR=1 PLAYWRIGHT_BASE_URL=http://localhost:3100 \
 *     pnpm exec playwright test tests/e2e/material-calculator.spec.ts
 */
test.describe('Auto Material Calculator — the gate is on', () => {
  test.skip(
    process.env.NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR !== '1',
    'NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR is not 1 — this build has the section compiled out.'
  );

  test('renders §3 in Step 3, expanded, with the billed quantity and no price', async ({ page }) => {
    // ARRANGE
    await page.goto('/quote');
    await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#lengthFt').fill('10');
    await page.locator('#quantity').fill('10');

    // ACT
    await page.getByRole('button', { name: 'Next' }).click();
    const section = page.locator('#material-calculator-heading');

    // ASSERT — the section exists and is expanded by default, per §3.
    await expect(
      section,
      'With the gate on, Step 3 must contain exactly one MaterialCalculatorSection.'
    ).toHaveCount(1);
    await expect(
      page.locator('[aria-labelledby="material-calculator-heading"] button'),
      '§3 says "collapsible accordion, expanded by default", so the toggle must report ' +
        'aria-expanded="true" on first render.'
    ).toHaveAttribute('aria-expanded', 'true');

    // The §2.1 breakdown, computed locally and therefore present immediately.
    await expect(
      page.getByText('Total ordered', { exact: true }),
      '§3 labels the billed quantity row "Total ordered". It is computed locally by the ' +
        'pure library, so it must be visible before any fetch resolves.'
    ).toBeVisible();
    await expect(
      page.getByText('110 LF').first(),
      '10 ft x 10 pieces is 100 LF, which bills 110 LF at the estimated 10% default — ' +
        'the figure SPEC §2.1 prints, and 110 rather than the 111 a bare Math.ceil gives.'
    ).toBeVisible();
    await expect(
      page.getByText('+ Waste factor (10%, estimated)'),
      'The "(estimated)" qualifier is required while pricing_rules carries no real ' +
        'per-product waste factor (SPEC §2.1 and §5).'
    ).toBeVisible();

    // The honest empty state, because product_accessories has no rows.
    await expect(
      page.getByText(/No accessory quantities are on file|Required with this order/),
      'The accessory area must either list real rows or say plainly that none are on ' +
        'file. An empty box with a heading and nothing under it is neither.'
    ).toBeVisible();

    // Still no price, with the section rendered.
    await expect(
      page.getByText(/\$[\d,]+(\.\d{2})?/),
      'CLAUDE.md rule #1 holds with the calculator visible: quantities only.'
    ).toHaveCount(0);

    await page.screenshot({
      path: 'test-results/ovn-03-material-calculator/step3-gate-on.png',
      fullPage: true,
    });
  });

  test('collapses and re-expands when the accordion header is pressed', async ({ page }) => {
    // ARRANGE
    await page.goto('/quote');
    await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('#lengthFt').fill('10');
    await page.locator('#quantity').fill('10');
    await page.getByRole('button', { name: 'Next' }).click();

    const toggle = page.locator('[aria-labelledby="material-calculator-heading"] button');

    // ACT
    await toggle.click();

    // ASSERT
    await expect(
      toggle,
      'Pressing the header must collapse the accordion.'
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(
      page.getByText('Total ordered', { exact: true }),
      'Collapsed means the body is gone, not merely hidden behind a class.'
    ).toHaveCount(0);

    // ACT
    await toggle.click();

    // ASSERT
    await expect(
      page.getByText('Total ordered', { exact: true }),
      'Pressing it again must bring the breakdown back.'
    ).toBeVisible();
  });
});

test.describe('POST /api/calculator/materials — the §4 contract', () => {
  test('computes the spec worked example: 100 LF bills 110 LF at the estimated 10%', async ({
    request,
  }) => {
    // ARRANGE / ACT
    const res = await request.post('/api/calculator/materials', { data: TEN_BY_TEN });

    // ASSERT
    expect(
      res.status(),
      `A valid label-less request must answer 200. The route is public by design — ` +
        `/quote supports guest submission — so a 401 here would break the guest flow. ` +
        `Got ${res.status()}.`
    ).toBe(200);

    const body = await res.json();
    expect(
      {
        rawQtyLf: body.rawQtyLf,
        adjustedQtyLf: body.adjustedQtyLf,
        wasteFactorPct: body.wasteFactorPct,
        wasteQtyLf: body.wasteQtyLf,
        isWasteEstimated: body.isWasteEstimated,
      },
      `SPEC §2.1's worked example is "100 LF + 10% waste = 110 LF", marked estimated ` +
        `until pricing_rules carries real per-product data. Note 110 and not 111: ` +
        `100 * 1.1 is 110.00000000000001 in IEEE 754 and a bare Math.ceil gives 111. ` +
        `Got ${JSON.stringify(body)}.`
    ).toEqual({
      rawQtyLf: 100,
      adjustedQtyLf: 110,
      wasteFactorPct: 10,
      wasteQtyLf: 10,
      isWasteEstimated: true,
    });
  });

  test('returns empty accessory arrays and not_attempted when no labels are sent', async ({
    request,
  }) => {
    // ARRANGE / ACT
    const res = await request.post('/api/calculator/materials', { data: TEN_BY_TEN });
    const body = await res.json();

    // ASSERT
    expect(
      {
        required: body.requiredAccessories,
        optional: body.optionalAccessories,
        uncalculable: body.uncalculableAccessories,
        resolution: body.productResolution,
        stock: body.stockOptimization,
      },
      `With no profile or material label there is nothing to resolve a product from, so ` +
        `the three accessory arrays must be empty and productResolution must say ` +
        `'not_attempted' rather than 'none' — "we did not look" and "we looked and found ` +
        `nothing" are different answers. stockOptimization is null because no stock ` +
        `length was sent. Got ${JSON.stringify(body)}.`
    ).toEqual({
      required: [],
      optional: [],
      uncalculable: [],
      resolution: 'not_attempted',
      stock: null,
    });
  });

  test('reports product resolution honestly when labels are sent but products is unseeded', async ({
    request,
  }) => {
    // ARRANGE — `products` has no rows (data-blocker checklist #17), so a real label
    // pair must resolve to 'none' and the accessory lists must stay empty.
    const res = await request.post('/api/calculator/materials', {
      data: { ...TEN_BY_TEN, profileLabel: 'Coping Cap', materialLabel: 'Copper' },
    });

    // ACT
    const body = await res.json();

    // ASSERT — 'resolved' with rows would mean the catalog has been seeded, which is a
    // legitimate future state; what must never happen is a resolution that invents
    // accessories, so both accepted outcomes are asserted explicitly.
    expect(
      ['none', 'ambiguous', 'resolved'].includes(body.productResolution),
      `productResolution must be one of the three real answers. Got ` +
        `${JSON.stringify(body.productResolution)}.`
    ).toBe(true);
    if (body.productResolution !== 'resolved') {
      expect(
        body.requiredAccessories.length + body.optionalAccessories.length,
        `A product that did not resolve must produce NO accessories. Anything here would ` +
          `be fabricated. Got ${JSON.stringify(body)}.`
      ).toBe(0);
    }
    expect(
      body.adjustedQtyLf,
      `The waste calculation must succeed regardless of whether a product resolved — it ` +
        `is pure arithmetic and does not depend on the catalog. Got ${body.adjustedQtyLf}.`
    ).toBe(110);
  });

  test('returns the §2.3 cut list when a stock length is supplied', async ({ request }) => {
    // ARRANGE — 100 LF raw against 10 ft stock, less the 0.0208 ft kerf
    const res = await request.post('/api/calculator/materials', {
      data: { ...TEN_BY_TEN, stockLengthFt: 10 },
    });

    // ACT
    const body = await res.json();

    // ASSERT
    expect(
      body.stockOptimization?.piecesOrdered,
      `100 LF cut from 10 ft stock with a 0.0208 ft kerf is 10.02 sticks, so 11 pieces. ` +
        `§2.3 cuts for the RAW footage, matching the already-shipped ` +
        `TrimLengthOptimizerSection. Got ${JSON.stringify(body.stockOptimization)}.`
    ).toBe(11);
  });

  test('answers 400 with named field details for a zero quantity, never 500', async ({ request }) => {
    // ARRANGE / ACT
    const res = await request.post('/api/calculator/materials', {
      data: { lengthFt: 0, pieces: 1 },
    });

    // ASSERT
    expect(
      res.status(),
      `A zero length is the caller's input problem and must answer 400. A 500 would say ` +
        `the server broke. Got ${res.status()}.`
    ).toBe(400);

    const body = await res.json();
    expect(
      body.details?.map((d: { field: string }) => d.field),
      `The 400 must name the offending field so the UI can point at the right input. ` +
        `Got ${JSON.stringify(body)}.`
    ).toEqual(['lengthFt']);
  });

  test('answers 400 for a fractional piece count', async ({ request }) => {
    // ARRANGE — half a piece of flashing is not orderable
    const res = await request.post('/api/calculator/materials', {
      data: { lengthFt: 10, pieces: 2.5 },
    });

    // ASSERT
    expect(
      res.status(),
      `2.5 pieces must be refused with a 400. Got ${res.status()}.`
    ).toBe(400);
    expect(
      (await res.json()).details?.[0]?.message,
      `The message must say what is wrong with it specifically, not reuse the ` +
        `greater-than-zero wording — 2.5 IS greater than zero.`
    ).toBe('Quantity must be a whole number of pieces.');
  });

  test('answers 400 for a malformed body, never 500', async ({ request }) => {
    // ARRANGE — not JSON at all
    const res = await request.post('/api/calculator/materials', {
      headers: { 'Content-Type': 'application/json' },
      data: 'this is not json',
    });

    // ASSERT
    expect(
      res.status(),
      `An unparseable body is a bad request, not a server fault. A 500 here would mean ` +
        `the route throws on input it should simply reject. Got ${res.status()}.`
    ).toBe(400);
  });

  test('answers 400 for an allocation-sized request rather than attempting it', async ({
    request,
  }) => {
    // ARRANGE — the route is PUBLIC and unauthenticated, and optimizeTrimLength builds
    // one object per cut piece, so this is the denial-of-service shape.
    const res = await request.post('/api/calculator/materials', {
      data: { lengthFt: 1e9, pieces: 1e9, stockLengthFt: 0.03 },
    });

    // ASSERT
    expect(
      res.status(),
      `A request for 1e18 LF must be refused outright. If this times out or returns 500 ` +
        `instead of 400, the resource guards in lib/material-calculator/validate.ts have ` +
        `been removed and this public route can be made to exhaust server memory. ` +
        `Got ${res.status()}.`
    ).toBe(400);
  });

  test('returns no money field of any kind', async ({ request }) => {
    // ARRANGE — CLAUDE.md rule #1, asserted on the wire and not only in the types
    const res = await request.post('/api/calculator/materials', { data: TEN_BY_TEN });

    // ACT
    const raw = await res.text();

    // ASSERT
    expect(
      /price|cost|cents|amount|dollar|usd|\$/i.test(raw),
      `The calculator's response must contain no money-shaped key or value. AFS sets the ` +
        `price internally and the customer sees it only on the formal quote. ` +
        `Got ${raw}.`
    ).toBe(false);
  });
});
