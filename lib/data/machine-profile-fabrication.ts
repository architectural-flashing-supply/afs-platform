import { createAdminClient } from '@/lib/supabase/admin';
import { bendSignature } from '@/lib/utils/bend-signature';

interface BendRow {
  profile_id: string;
  left_leg_in: number | null;
  right_leg_in: number | null;
  bend_angle_degrees: number | null;
}

/**
 * Approximates "how many times has this shape been fabricated" using the
 * Thalmann DB's real job history: each machine_profiles row is one job that
 * was actually run on the machine (see scripts/import-machine-profiles.ts'
 * header), so profiles across the *entire* catalog — public and private —
 * whose bend sequence matches within a coarse tolerance represent repeat
 * runs of the same physical profile over the shop's history. Counts are
 * computed over all profiles (private included, since a public template may
 * also have been run under private/customer-named jobs), but only the
 * resulting number — never private names or ids — is exposed to callers.
 */
export async function computeFabricationCounts(
  admin: ReturnType<typeof createAdminClient>
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from('machine_profile_bends')
    .select('profile_id, step_number, left_leg_in, right_leg_in, bend_angle_degrees')
    .order('step_number', { ascending: true });
  if (error || !data) return new Map();

  const bendsByProfile = new Map<string, BendRow[]>();
  for (const row of data as BendRow[]) {
    const list = bendsByProfile.get(row.profile_id) ?? [];
    list.push(row);
    bendsByProfile.set(row.profile_id, list);
  }

  const signatureByProfile = new Map<string, string>();
  const countBySignature = new Map<string, number>();
  for (const [profileId, bends] of bendsByProfile) {
    const sig = bendSignature(bends);
    signatureByProfile.set(profileId, sig);
    countBySignature.set(sig, (countBySignature.get(sig) ?? 0) + 1);
  }

  const countByProfile = new Map<string, number>();
  for (const [profileId, sig] of signatureByProfile) {
    countByProfile.set(profileId, countBySignature.get(sig) ?? 1);
  }
  return countByProfile;
}
