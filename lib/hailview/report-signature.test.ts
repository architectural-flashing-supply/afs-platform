import { describe, expect, it } from 'vitest';
import {
  REPORT_SIGNATURE_TTL_SECONDS,
  reportSignatureSecret,
  signHailViewReport,
  verifyHailViewReportSignature,
  type SignableReport,
} from './report-signature';

// The email endpoint is unauthenticated and sends AFS-branded mail from AFS's
// own domain. hv2-02 made the content INERT (escaping); these tests cover
// hv2-03, which makes it GENUINE: the endpoint refuses any report it cannot
// verify, so the caller can no longer author the prose AFS delivers.

const SECRET = 'test-secret-value';
const NOW = new Date('2026-10-08T12:00:00Z');

function report(overrides: Partial<SignableReport> = {}): SignableReport {
  return {
    address: 'Burnet, Burnet County, Texas, 78611, United States',
    material: 'asphalt_shingle',
    score: 18,
    tier: 'Low',
    narrative: 'First paragraph.\n\nSecond paragraph.',
    probability: 0.185,
    low: 0.052,
    high: 0.363,
    evidenceGrade: 'B',
    evidenceGradeReason: 'This result rests on the 2026-05-10 storm.',
    modelVersion: 'v2.0-uncalibrated',
    claimWindowMonths: 12,
    cosmeticExclusion: false,
    sensitivityNote: 'A quarter-inch change moves the result from 5 to 36.',
    perEvent: [
      {
        convectiveDayUtc: '2026-05-10',
        estimatedSizeIn: 0.97,
        estimatedSizeLowIn: 0.82,
        estimatedSizeHighIn: 1.13,
        reportCount: 2,
        measuredCount: 2,
        estimatedCount: 0,
        interpolation: 'extrapolated',
        windowStatus: 'in_window',
        windowLabel: 'Within the typical 12-month claim window',
      },
    ],
    ...overrides,
  };
}

function sign(r: SignableReport, now = NOW): string {
  return signHailViewReport(r, { secret: SECRET, now });
}
function verify(r: SignableReport, sig: unknown, now = NOW) {
  return verifyHailViewReportSignature(r, sig, { secret: SECRET, now });
}

describe('a genuine report verifies', () => {
  it('round-trips', () => {
    const r = report();
    expect(verify(r, sign(r)).ok).toBe(true);
  });

  it('is deterministic for the same report and the same clock', () => {
    const r = report();
    expect(sign(r)).toBe(sign(r));
  });

  it('round-trips a minimal pre-V2-shaped report with every optional field absent', () => {
    const r: SignableReport = {
      address: 'Burnet, TX',
      material: 'asphalt_shingle',
      score: 42,
      tier: 'Moderate',
      narrative: 'Some prose.',
    };
    expect(verify(r, sign(r)).ok).toBe(true);
  });

  it('round-trips an empty perEvent list, and does NOT treat it as absent', () => {
    const withEmpty = report({ perEvent: [] });
    const withAbsent = report({ perEvent: undefined });
    expect(verify(withEmpty, sign(withEmpty)).ok).toBe(true);
    // An empty list and a missing list render differently (the email prints
    // its honest "no storms found" block for one and omits the section for
    // the other), so they must not share a signature.
    expect(verify(withAbsent, sign(withEmpty)).ok).toBe(false);
  });
});

describe('ANY alteration invalidates the signature', () => {
  it('rejects altered prose — the field that made the original hole dangerous', () => {
    const genuine = report();
    const signature = sign(genuine);
    const tampered = report({
      narrative: 'Your AFS account is suspended. Call 555-0100 immediately.',
    });
    const verdict = verify(tampered, signature);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('tampered');
  });

  it('rejects a single altered digit of the number', () => {
    const signature = sign(report());
    expect(verify(report({ score: 19 }), signature).ok).toBe(false);
    expect(verify(report({ probability: 0.186 }), signature).ok).toBe(false);
    expect(verify(report({ low: 0.051 }), signature).ok).toBe(false);
  });

  it('rejects an altered address, material, tier or grade', () => {
    const signature = sign(report());
    expect(verify(report({ address: 'Somewhere Else, TX' }), signature).ok).toBe(false);
    expect(verify(report({ material: 'metal_standing_seam' }), signature).ok).toBe(false);
    expect(verify(report({ tier: 'High' }), signature).ok).toBe(false);
    expect(verify(report({ evidenceGrade: 'A' }), signature).ok).toBe(false);
  });

  it('rejects an altered reason, note or model version', () => {
    const signature = sign(report());
    expect(verify(report({ evidenceGradeReason: 'Something else.' }), signature).ok).toBe(false);
    expect(verify(report({ sensitivityNote: 'Something else.' }), signature).ok).toBe(false);
    expect(verify(report({ modelVersion: 'v9-calibrated' }), signature).ok).toBe(false);
  });

  it('rejects an altered per-event row, including just its label', () => {
    const genuine = report();
    const signature = sign(genuine);
    const events = genuine.perEvent!;
    expect(
      verify(report({ perEvent: [{ ...events[0], estimatedSizeIn: 3.5 }] }), signature).ok
    ).toBe(false);
    expect(
      verify(report({ perEvent: [{ ...events[0], windowLabel: 'Totally fine' }] }), signature).ok
    ).toBe(false);
    expect(
      verify(report({ perEvent: [{ ...events[0], windowStatus: 'outside_window' }] }), signature).ok
    ).toBe(false);
  });

  it('rejects an EXTRA per-event row appended to a genuine report', () => {
    const genuine = report();
    const signature = sign(genuine);
    const extra = { ...genuine.perEvent![0], convectiveDayUtc: '2026-09-01' };
    expect(verify(report({ perEvent: [...genuine.perEvent!, extra] }), signature).ok).toBe(false);
  });

  it('rejects a flipped cosmeticExclusion', () => {
    expect(verify(report({ cosmeticExclusion: true }), sign(report())).ok).toBe(false);
  });

  it('is not fooled by moving characters between adjacent fields', () => {
    // The canonical form length-prefixes every value. Without that, these two
    // reports would serialise to the same byte string and share a MAC.
    const a = report({ address: 'AB', narrative: 'CD' });
    const b = report({ address: 'A', narrative: 'BCD' });
    expect(verify(b, sign(a)).ok).toBe(false);
    expect(verify(a, sign(b)).ok).toBe(false);
  });
});

describe('a forged or malformed signature is refused', () => {
  it('refuses a missing, empty or wrong-typed signature', () => {
    const r = report();
    for (const bad of [undefined, null, '', '   ', 42, {}, []]) {
      const verdict = verify(r, bad);
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.reason).toBe('malformed');
    }
  });

  it('refuses a signature with the wrong shape', () => {
    const r = report();
    for (const bad of ['nodot', 'a.b.c', '.abc', 'abc.', 'notanumber.abc']) {
      expect(verify(r, bad).ok).toBe(false);
    }
  });

  it('refuses a signature made with a DIFFERENT secret', () => {
    const r = report();
    const foreign = signHailViewReport(r, { secret: 'some-other-secret', now: NOW });
    const verdict = verify(r, foreign);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('tampered');
  });

  it('refuses a truncated or padded MAC rather than throwing', () => {
    const r = report();
    const good = sign(r);
    const [exp, mac] = good.split('.');
    expect(verify(r, `${exp}.${mac.slice(0, -4)}`).ok).toBe(false);
    expect(verify(r, `${exp}.${mac}AAAA`).ok).toBe(false);
  });
});

describe('the expiry is signed, so a forged one is never believed', () => {
  it('accepts a signature inside its TTL and refuses one past it', () => {
    const r = report();
    const signature = sign(r);
    const justInside = new Date(NOW.getTime() + (REPORT_SIGNATURE_TTL_SECONDS - 1) * 1000);
    const justOutside = new Date(NOW.getTime() + (REPORT_SIGNATURE_TTL_SECONDS + 2) * 1000);

    expect(verify(r, signature, justInside).ok).toBe(true);
    const late = verify(r, signature, justOutside);
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.reason).toBe('expired');
  });

  it('reports TAMPERED, not expired, when the expiry itself is rewritten', () => {
    // The MAC covers the expiry, and is checked BEFORE it — so extending a
    // link by editing its visible expiry fails as a forgery.
    const r = report();
    const signature = sign(r);
    const [, mac] = signature.split('.');
    const farFuture = Math.floor(NOW.getTime() / 1000) + 10 * 365 * 24 * 3600;
    const verdict = verify(r, `${farFuture}.${mac}`);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('tampered');
  });

  it('keeps the TTL short — this is the bound on replaying a genuine report', () => {
    expect(REPORT_SIGNATURE_TTL_SECONDS).toBeLessThanOrEqual(24 * 60 * 60);
  });
});

describe('the signing secret', () => {
  it('prefers the explicit variable', () => {
    expect(reportSignatureSecret({ HAILVIEW_REPORT_SECRET: 'explicit' })).toBe('explicit');
  });

  it('derives from the service-role key when no explicit secret is set', () => {
    const derived = reportSignatureSecret({ SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' });
    expect(derived).toMatch(/^[0-9a-f]{64}$/);
    // Key separation: the derived key must not BE the service role key, and
    // must not be recoverable from it by anything but the same HMAC.
    expect(derived).not.toBe('service-role-key');
    expect(derived).not.toContain('service-role-key');
  });

  it('derives a DIFFERENT key from the quote-approve token, under the same service key', async () => {
    // Both modules derive from SUPABASE_SERVICE_ROLE_KEY. If they shared a
    // label they would share a key, and a value signed for one purpose could
    // be presented for the other.
    const { approveTokenSecret } = await import('../pricing/approve-token');
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' };
    expect(reportSignatureSecret(env)).not.toBe(approveTokenSecret(env));
  });

  it('THROWS rather than signing with nothing', () => {
    expect(() => reportSignatureSecret({})).toThrow(/neither HAILVIEW_REPORT_SECRET nor SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => reportSignatureSecret({ HAILVIEW_REPORT_SECRET: '   ' })).toThrow();
  });
});
