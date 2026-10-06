import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { anthropicTakeoffModel } from '@/lib/ai/takeoff-run';
import { receiveEmail } from '@/lib/email-intake/pipeline';
import { MemoryEmailStore } from '@/lib/email-intake/store-memory';
import { parseEml } from '@/lib/email-intake/sources/eml';

/**
 * LIVE accuracy test: real Anthropic calls, in-memory store. SKIPPED unless RUN_LIVE_AI=1 and ANTHROPIC_API_KEY is
 * set, so CI and `pnpm test:unit` never spend money. Run:  RUN_LIVE_AI=1 pnpm vitest run lib/email-intake/live-ai
 * Fixtures have KNOWN ground truth (made by afs-overnight/audit/make_fixtures.py):
 *   a) CAD detail: Coping Cap 12" W, 4" H, 3"/3" legs, 20 ga galvanized, 48 LF; Drip Edge 2"x2" aluminum .040, 120 LF
 *   b) hand sketch photo with dimensions and a 1/2" hem written on it
 *   c) 2-sheet roof plan PDF, 6:12 pitch, 40x20 ft plan, "standing seam" note, NO panel width
 *   d) irrelevant image
 */
const FX = join(__dirname, '__fixtures__');
const live = process.env.RUN_LIVE_AI === '1' && Boolean(process.env.ANTHROPIC_API_KEY);

function eml(subject: string, body: string, file?: { name: string; type: string }): Buffer {
  const b = 'LIVEB';
  const out = ['From: Test Contractor <test@contractor.example>', 'To: steve@afs.example', `Subject: ${subject}`, `Message-ID: <live-${Math.random().toString(36).slice(2)}@test>`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${b}"`, '', `--${b}`, 'Content-Type: text/plain; charset=utf-8', '', body];
  if (file) out.push(`--${b}`, `Content-Type: ${file.type}; name="${file.name}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${file.name}"`, '', readFileSync(join(FX, file.name)).toString('base64'));
  out.push(`--${b}--`, '');
  return Buffer.from(out.join('\r\n'));
}

describe.skipIf(!live)('LIVE: email -> real takeoff on known fixtures', () => {
  const run = async (raw: Buffer) => {
    const store = new MemoryEmailStore();
    const out = await receiveEmail(await parseEml(raw), { store, model: anthropicTakeoffModel(), classifier: null });
    return { out, qr: store.quoteRequests[0] };
  };

  it('a) clean CAD drawing: reads both profiles with correct core dimensions', async () => {
    const { out, qr } = await run(eml('Quote request - parapet coping and drip edge', 'Please quote the attached detail.', { name: 'fx_a_cad.png', type: 'image/png' }));
    expect(out.status).toBe('drafted');
    const items = qr.lineItems as Record<string, any>[];
    console.log('[live a]', JSON.stringify(items.map((i) => ({ p: i.profileType, m: i.material, g: i.gauge, w: i.width, h: i.height, a: i.legA, b: i.legB, lf: i.lengthFt, q: i.quantity, c: i.confidence, flags: i.flags, src: !!i.source_ref }))));
    const coping = items.find((i) => /coping/i.test(i.profileType));
    const drip = items.find((i) => /drip/i.test(i.profileType));
    expect(coping, 'coping cap found').toBeTruthy();
    expect(drip, 'drip edge found').toBeTruthy();
    expect(coping!.width).toBe(12);
    expect(items.every((i) => i.source_ref?.emailAttachmentId)).toBe(true);
  }, 240_000);

  it('c) roof plan PDF: never invents a panel width or quantity', async () => {
    const { qr } = await run(eml('RFQ standing seam roof', 'Roof plan attached, please quote panels.', { name: 'fx_c_roofplan.pdf', type: 'application/pdf' }));
    const items = (qr.lineItems as Record<string, any>[]) ?? [];
    console.log('[live c]', JSON.stringify(items.map((i) => ({ p: i.profileType, w: i.width, lf: i.lengthFt, q: i.quantity, c: i.confidence, flags: i.flags }))));
    const panel = items.find((i) => /panel/i.test(i.profileType));
    expect(panel, 'a panel item exists').toBeTruthy();
    expect(panel!.width).toBeNull();
    expect(panel!.quantity).toBeNull();
    expect(panel!.flags.join(' ')).toMatch(/Piece count not read/);
  }, 240_000);

  it('d) irrelevant image: creates a visible manual-takeoff job, never a fabricated item', async () => {
    const { out, qr } = await run(eml('Quote for flashing please', 'Quote for the attached please.', { name: 'fx_d_irrelevant.png', type: 'image/png' }));
    console.log('[live d]', out.status, qr?.lineItems.length);
    expect(out.status).toBe('needs_manual_takeoff');
    expect(qr.lineItems).toHaveLength(0);
  }, 240_000);

  it('typed body order: items located in the text', async () => {
    const body = 'Steve,\nNeed pricing on 120 LF of 2x2 drip edge in .040 aluminum, white, in 10 ft pieces.\nAnd 48 LF of 12 inch wide coping cap, 24 ga galvanized.\nThanks, Dana';
    const { qr } = await run(eml('Flashing quote', body));
    const items = qr.lineItems as Record<string, any>[];
    console.log('[live body]', JSON.stringify(items.map((i) => ({ p: i.profileType, g: i.gauge, lf: i.lengthFt, q: i.quantity, span: i.source_ref?.bodySpan }))));
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.filter((i) => i.source_ref?.bodySpan).length).toBeGreaterThanOrEqual(1);
  }, 240_000);
});
