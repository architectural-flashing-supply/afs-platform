import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface ProfileRow {
  id: string;
  name_en: string;
  blank_width_in: number | null;
}

interface BendRow {
  step_number: number;
  left_leg_in: number | null;
  right_leg_in: number | null;
  bend_angle_degrees: number | null;
}

// machine_profiles/machine_profile_bends RLS requires auth.uid() IS NOT NULL
// even on is_public = true rows (see SCHEMA.md's MACHINE INTEGRATION TABLES
// and app/studio/library/page.tsx's own comment) — so an anonymous FlashDraft
// visitor loading a public library profile can't read it through the normal
// session client. This route does the lookup with the service-role client
// and enforces the actual privacy rule in application code instead: a
// public + active profile is visible to anyone, a private one only to a
// logged-in admin, otherwise 404 — same pattern as
// app/studio/profile-viewer/[profileId]/page.tsx and
// app/studio/library/page.tsx.
export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: viewerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    isAdmin = viewerProfile?.role === 'admin';
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('machine_profiles')
    .select('id, name_en, blank_width_in, is_public, is_active')
    .eq('id', params.id)
    .maybeSingle<ProfileRow & { is_public: boolean; is_active: boolean }>();

  if (!profile || !profile.is_active || (!profile.is_public && !isAdmin)) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  const { data: bendRows } = await admin
    .from('machine_profile_bends')
    .select('step_number, left_leg_in, right_leg_in, bend_angle_degrees')
    .eq('profile_id', profile.id)
    .order('step_number', { ascending: true })
    .returns<BendRow[]>();

  return NextResponse.json({
    profile: {
      id: profile.id,
      name_en: profile.name_en,
      blank_width_in: profile.blank_width_in,
    },
    bends: bendRows ?? [],
  });
}
