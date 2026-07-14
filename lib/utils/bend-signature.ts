interface SignatureBend {
  left_leg_in: number | null;
  right_leg_in: number | null;
  bend_angle_degrees: number | null;
}

// Coarse rounding buckets — this signature is used to detect "the same
// physical profile run more than once" across the shop's real job history,
// not to distinguish CAD-precise duplicates, so nearby values collapse
// together on purpose (see machine-profile-fabrication.ts).
const LEG_ROUND_IN = 0.25;
const ANGLE_ROUND_DEG = 5;

export function bendSignature(bends: SignatureBend[]): string {
  return bends
    .map((b) => {
      const left = Math.round((b.left_leg_in ?? 0) / LEG_ROUND_IN) * LEG_ROUND_IN;
      const right = Math.round((b.right_leg_in ?? 0) / LEG_ROUND_IN) * LEG_ROUND_IN;
      const angle = Math.round((b.bend_angle_degrees ?? 0) / ANGLE_ROUND_DEG) * ANGLE_ROUND_DEG;
      return `${left.toFixed(2)}|${angle}|${right.toFixed(2)}`;
    })
    .join(';');
}
