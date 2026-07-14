import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeFabricationCounts } from '@/lib/data/machine-profile-fabrication';

interface InputBend {
  angle: number;
  leftLeg: number;
  rightLeg: number;
}

interface MatchRequestBody {
  bends?: InputBend[];
  blankWidth?: number;
}

interface ProfileRow {
  id: string;
  name_en: string;
  profile_number: string;
  blank_width_in: number | null;
  match_tolerance_pct: number;
}

interface BendRow {
  profile_id: string;
  step_number: number;
  left_leg_in: number | null;
  right_leg_in: number | null;
  bend_angle_degrees: number | null;
  left_leg_mm: number | null;
  right_leg_mm: number | null;
  radius_mm: number | null;
}

export interface DiagramBend {
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

export interface ProfileMatch {
  profileId: string;
  nameEn: string;
  profileNumber: string;
  score: number;
  isExactMatch: boolean;
  fabricatedCount: number;
}

const EXACT_MATCH_THRESHOLD = 95;
const DIAGRAM_PREVIEW_THRESHOLD = 70;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Bends are compared in inches — the FlashDraft canvas works natively in
// inches, and machine_profiles/machine_profile_bends store both mm and in,
// so comparing directly against the *_in columns avoids a round-trip
// conversion.
function scoreProfile(input: InputBend[], candidate: BendRow[], toleranceRatio: number): number {
  const lengthDiff = Math.abs(candidate.length - input.length);
  const maxLen = Math.max(candidate.length, input.length, 1);
  const bendCountScore = clamp01(1 - lengthDiff / maxLen);

  const pairCount = Math.min(candidate.length, input.length);
  if (pairCount === 0) return bendCountScore * 0.3 * 100;

  let angleTotal = 0;
  let legTotal = 0;
  for (let i = 0; i < pairCount; i++) {
    const c = candidate[i];
    const inBend = input[i];

    const cAngle = c.bend_angle_degrees ?? 0;
    angleTotal += clamp01(1 - Math.abs(cAngle - inBend.angle) / 180);

    const cLeft = c.left_leg_in ?? 0;
    const cRight = c.right_leg_in ?? 0;
    const leftTolerance = Math.max(cLeft * toleranceRatio, 0.0625);
    const rightTolerance = Math.max(cRight * toleranceRatio, 0.0625);
    const leftScore = clamp01(1 - Math.abs(cLeft - inBend.leftLeg) / (leftTolerance * 4));
    const rightScore = clamp01(1 - Math.abs(cRight - inBend.rightLeg) / (rightTolerance * 4));
    legTotal += (leftScore + rightScore) / 2;
  }

  const avgAngleScore = angleTotal / pairCount;
  const avgLegScore = legTotal / pairCount;

  return (bendCountScore * 0.3 + avgAngleScore * 0.35 + avgLegScore * 0.35) * 100;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const body = raw as MatchRequestBody;
  const bends = Array.isArray(body.bends) ? body.bends : [];
  if (bends.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('machine_profiles')
    .select('id, name_en, profile_number, blank_width_in, match_tolerance_pct')
    .eq('is_public', true)
    .eq('is_active', true);
  if (profilesError) {
    return NextResponse.json({ error: 'Could not load profile library.' }, { status: 500 });
  }
  const profileRows = (profiles ?? []) as ProfileRow[];
  if (profileRows.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  const { data: bendRows, error: bendsError } = await supabase
    .from('machine_profile_bends')
    .select('profile_id, step_number, left_leg_in, right_leg_in, bend_angle_degrees, left_leg_mm, right_leg_mm, radius_mm')
    .in('profile_id', profileRows.map((p) => p.id))
    .order('step_number', { ascending: true });
  if (bendsError) {
    return NextResponse.json({ error: 'Could not load bend sequences.' }, { status: 500 });
  }

  const bendsByProfile = new Map<string, BendRow[]>();
  for (const row of (bendRows ?? []) as BendRow[]) {
    const list = bendsByProfile.get(row.profile_id) ?? [];
    list.push(row);
    bendsByProfile.set(row.profile_id, list);
  }

  // Fabrication counts are computed across the full catalog (public +
  // private) via the admin client — see computeFabricationCounts for why —
  // but only surfaced here for the public profiles already selected above.
  const admin = createAdminClient();
  const fabricationCounts = await computeFabricationCounts(admin);

  const scored = profileRows
    .map((profile) => {
      const candidateBends = bendsByProfile.get(profile.id) ?? [];
      const toleranceRatio = (profile.match_tolerance_pct ?? 5) / 100;
      const score = scoreProfile(bends, candidateBends, toleranceRatio);
      return { profile, candidateBends, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const matches: ProfileMatch[] = scored.map(({ profile, score }) => ({
    profileId: profile.id,
    nameEn: profile.name_en,
    profileNumber: profile.profile_number,
    score,
    isExactMatch: score >= EXACT_MATCH_THRESHOLD,
    fabricatedCount: fabricationCounts.get(profile.id) ?? 1,
  }));

  // Diagram geometry for the floating canvas preview — only the top match,
  // and only once it clears the preview threshold, to keep the payload small.
  let topMatchDiagramBends: DiagramBend[] | null = null;
  if (scored.length > 0 && scored[0].score >= DIAGRAM_PREVIEW_THRESHOLD) {
    topMatchDiagramBends = scored[0].candidateBends.map((b) => ({
      leftLegMm: b.left_leg_mm,
      rightLegMm: b.right_leg_mm,
      bendAngleDegrees: b.bend_angle_degrees,
      radiusMm: b.radius_mm,
    }));
  }

  return NextResponse.json({ matches, topMatchDiagramBends });
}
