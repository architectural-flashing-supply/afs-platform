/**
 * PathfinderEdge Profile Object Format conformance (F-02).
 *
 * Every expectation here is anchored to AMS Controls' published spec,
 * "Pathfinder Edge - Profile Object Format"
 * (https://www.amscontrols.com/wp-content/uploads/2021/02/Profile-Object.pdf),
 * including its two worked examples reproduced verbatim: the 3" U-channel
 * (p.1) and "V Shaped Thingy" (p.5-6).
 *
 * Pure functions only - no network, no database.
 */

import { describe, it, expect } from 'vitest';
import {
  flashDraftToMachineProfile,
  specBendAngleAt,
  toPaintedSide,
  type FlashDraftPointInput,
} from './flashdraft-to-pathfinder';
import { buildFeaturesForTest, toSpecBendAngle, type MachineProfile } from './pathfinder-edge';

const MM = 25.4;

// FlashDraft world coordinates are INCHES and y-DOWN.
const pt = (x: number, y: number, radius?: number): FlashDraftPointInput =>
  radius === undefined ? { x, y } : { x, y, radius };

function featuresFrom(input: Parameters<typeof flashDraftToMachineProfile>[0]) {
  return buildFeaturesForTest(flashDraftToMachineProfile(input));
}

const base = { material: 'Galvanized Steel', thicknessIn: 0.02 };

describe('toSpecBendAngle - interior angle to spec bend angle', () => {
  it('converts the spec V (interior 45) to a 135 bend', () => {
    expect(Math.abs(toSpecBendAngle(45))).toBe(135);
    expect(Math.abs(toSpecBendAngle(-45))).toBe(135);
  });
  it('keeps a 90 fold at 90 (the case that hid the bug)', () => {
    expect(Math.abs(toSpecBendAngle(90))).toBe(90);
  });
  it('treats collinear (interior 180) as no bend', () => {
    expect(toSpecBendAngle(180)).toBe(0);
    expect(toSpecBendAngle(-180)).toBe(0);
  });
  it('treats a flat hairpin (interior 0) as a half turn', () => {
    expect(toSpecBendAngle(0)).toBe(180);
  });
  it('inverts sign - the un-mirroring step', () => {
    expect(Math.sign(toSpecBendAngle(45))).toBe(-1);
    expect(Math.sign(toSpecBendAngle(-45))).toBe(1);
  });
});

describe('specBendAngleAt - sign convention (spec p.1: minus right/CW, plus left/CCW)', () => {
  // y-DOWN world. Travelling +x (rightwards on screen), then turning to
  // -y (upwards on screen) is a LEFT turn as the operator sees it.
  it('is positive for a left/counter-clockwise turn', () => {
    expect(specBendAngleAt(pt(0, 0), pt(10, 0), pt(10, -10))).toBeCloseTo(90, 9);
  });
  it('is negative for a right/clockwise turn', () => {
    expect(specBendAngleAt(pt(0, 0), pt(10, 0), pt(10, 10))).toBeCloseTo(-90, 9);
  });
  it('is 0 for a straight-through point', () => {
    expect(specBendAngleAt(pt(0, 0), pt(5, 0), pt(10, 0))).toBe(0);
  });
});

describe('spec example (p.1): 3in U-channel', () => {
  it('reproduces the spec feature list exactly', () => {
    const features = featuresFrom({
      ...base,
      profileName: 'U',
      points: [pt(0, -3), pt(0, 0), pt(3, 0), pt(3, -3)],
    });
    expect(features).toEqual([
      { type: 'Straight', length: 3 },
      { type: 'Angle', angle: 90 },
      { type: 'Straight', length: 3 },
      { type: 'Angle', angle: 90 },
      { type: 'Straight', length: 3 },
    ]);
  });

  it('emits no Radius even though every FlashDraft bend carries a corner radius', () => {
    const features = featuresFrom({
      ...base,
      profileName: 'U',
      points: [pt(0, -3, 0.5), pt(0, 0, 0.5), pt(3, 0, 0.5), pt(3, -3, 0.5)],
    });
    expect(features.some((f) => f.type === 'Radius')).toBe(false);
    expect(features.filter((f) => f.type === 'Angle')).toHaveLength(2);
  });
});

describe('spec example (p.5-6): V Shaped Thingy', () => {
  // A V with a 45 interior angle -> a 135 bend, per the spec's own listing.
  const leg = 3;
  const rad = (d: number) => (d * Math.PI) / 180;
  // Drawn in y-down world so the V opens upward on screen.
  const apex = pt(0, 0);
  const left = pt(-leg * Math.cos(rad(67.5)), -leg * Math.sin(rad(67.5)));
  const right = pt(leg * Math.cos(rad(67.5)), -leg * Math.sin(rad(67.5)));

  it('emits a single Angle of magnitude 135, not the 45 interior angle', () => {
    const features = featuresFrom({ ...base, profileName: 'V', points: [left, apex, right] });
    const angles = features.filter((f) => f.type === 'Angle');
    expect(angles).toHaveLength(1);
    expect(Math.abs(angles[0].angle as number)).toBeCloseTo(135, 6);
  });

  it('matches the spec listing shape with a closed hem left and open hem right', () => {
    const features = featuresFrom({
      ...base,
      profileName: 'V Shaped Thingy',
      points: [left, apex, right],
      hemStart: { type: 'smashed', gapIn: 0, lengthIn: 0.5, kick: 'outside' },
      hemEnd: { type: 'open', gapIn: 0, lengthIn: 0.5, kick: 'outside' },
    });
    expect(features.map((f) => f.type)).toEqual([
      'Straight',
      'ClosedHem',
      'Straight',
      'Angle',
      'Straight',
      'OpenHem',
      'Straight',
    ]);
    expect(features[0]).toEqual({ type: 'Straight', length: 0.5 });
    expect(features[6]).toEqual({ type: 'Straight', length: 0.5 });
    // ClosedHem carries no hemHeight (spec p.2).
    expect(features[1]).not.toHaveProperty('hemHeight');
  });
});

describe('12in x 12in 90 degree with 3/16in open hems both ends (the verification part)', () => {
  const points = [pt(0, -12), pt(0, 0), pt(12, 0)];
  const hem = { type: 'open' as const, gapIn: 0.1875, lengthIn: 0.5, kick: 'outside' as const };

  it('produces the exact spec-conformant feature array', () => {
    const features = featuresFrom({
      ...base,
      profileName: 'AFS-SPEC-TEST-12x12',
      points,
      hemStart: hem,
      hemEnd: hem,
    });
    expect(features).toEqual([
      { type: 'Straight', length: 0.5 },
      { type: 'OpenHem', hemHeight: 0.1875, hemDirection: 'Negative' },
      { type: 'Straight', length: 12 },
      { type: 'Angle', angle: 90 },
      { type: 'Straight', length: 12 },
      { type: 'OpenHem', hemHeight: 0.1875, hemDirection: 'Negative' },
      { type: 'Straight', length: 0.5 },
    ]);
  });

  it('puts the open-hem gap into hemHeight in inches', () => {
    const features = featuresFrom({ ...base, profileName: 'x', points, hemStart: hem });
    const open = features.find((f) => f.type === 'OpenHem');
    expect(open?.hemHeight).toBe(0.1875);
  });

  it('sums to a 25in blank (0.5 + 12 + 12 + 0.5)', () => {
    const features = featuresFrom({
      ...base,
      profileName: 'x',
      points,
      hemStart: hem,
      hemEnd: hem,
    });
    const total = features.reduce((n, f) => n + (f.length ?? 0), 0);
    expect(total).toBeCloseTo(25, 9);
  });
});

describe('hemDirection follows the adjacent bend, not a fixed per-kick constant', () => {
  const hem = { type: 'open' as const, gapIn: 0.25, lengthIn: 0.5, kick: 'outside' as const };
  const dirOf = (points: FlashDraftPointInput[]) =>
    featuresFrom({ ...base, profileName: 'h', points, hemStart: hem }).find((f) => f.type === 'OpenHem')
      ?.hemDirection;

  it('flips with the direction of the bend', () => {
    const leftTurn = dirOf([pt(0, 0), pt(10, 0), pt(10, -10)]);
    const rightTurn = dirOf([pt(0, 0), pt(10, 0), pt(10, 10)]);
    expect(leftTurn).not.toBe(rightTurn);
  });

  it('puts an outside hem on the convex side of a left-turning profile', () => {
    expect(dirOf([pt(0, 0), pt(10, 0), pt(10, -10)])).toBe('Negative');
  });
});

describe('paintedSide (spec p.5: left = Positive, right = Negative of the FIRST segment)', () => {
  it('maps unpainted to None', () => {
    expect(toPaintedSide(null)).toBe('None');
    expect(toPaintedSide(undefined)).toBe('None');
  });
  it('maps FlashDraft up to Negative and down to Positive', () => {
    expect(toPaintedSide('up')).toBe('Negative');
    expect(toPaintedSide('down')).toBe('Positive');
  });
  it('reaches the MachineProfile that gets serialised', () => {
    const profile: MachineProfile = flashDraftToMachineProfile({
      ...base,
      profileName: 'p',
      points: [pt(0, 0), pt(10, 0), pt(10, -10)],
      paintFace: 'down',
    });
    expect(profile.paintedSide).toBe('Positive');
  });
});

describe('F-01 finiteness guards remain intact', () => {
  it('still rejects a non-finite coordinate', () => {
    expect(() =>
      flashDraftToMachineProfile({ ...base, profileName: 'bad', points: [pt(0, 0), pt(Number.NaN, 5)] })
    ).toThrow(/non-finite/i);
  });
  it('still rejects a non-finite hem dimension', () => {
    expect(() =>
      flashDraftToMachineProfile({
        ...base,
        profileName: 'bad',
        points: [pt(0, 0), pt(10, 0)],
        hemStart: { type: 'open', gapIn: Number.POSITIVE_INFINITY, lengthIn: 0.5, kick: 'outside' },
      })
    ).toThrow(/non-finite/i);
  });
  it('rejects a non-finite spec bend angle before it reaches the wire', () => {
    const profile: MachineProfile = {
      id: 'x',
      nameEn: 'x',
      profileNumber: 'x',
      blankWidthMm: 100,
      bends: [
        {
          stepNumber: 1,
          leftLegMm: 10 * MM,
          rightLegMm: 10 * MM,
          bendAngleDegrees: null,
          specBendAngleDegrees: Number.NaN,
          radiusMm: 0,
        },
      ],
    };
    expect(() => buildFeaturesForTest(profile)).toThrow(/not a finite number/i);
  });
});

describe('Radius is emitted only for an explicit curved arc', () => {
  const arcProfile = (isCurvedArc: boolean): MachineProfile => ({
    id: 'x',
    nameEn: 'x',
    profileNumber: 'x',
    blankWidthMm: 100,
    bends: [
      {
        stepNumber: 1,
        leftLegMm: 10 * MM,
        rightLegMm: 10 * MM,
        bendAngleDegrees: 90,
        specBendAngleDegrees: 90,
        radiusMm: 3 * MM,
        isCurvedArc,
      },
    ],
  });

  it('emits Angle for an ordinary fold that merely has a corner radius', () => {
    expect(buildFeaturesForTest(arcProfile(false))[1]).toEqual({ type: 'Angle', angle: 90 });
  });

  it('emits Radius with angle/radius/radiusQuality when explicitly marked', () => {
    expect(buildFeaturesForTest(arcProfile(true))[1]).toEqual({
      type: 'Radius',
      radius: 3,
      radiusQuality: 'Medium',
      angle: 90,
    });
  });
});
