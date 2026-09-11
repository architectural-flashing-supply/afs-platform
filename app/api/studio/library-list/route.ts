import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Without this, Next statically prerenders the GET handler at build time —
// createAdminClient() then runs with no request context and fails the build
// (found via `vercel build` while chasing an unrelated preview-deploy issue,
// hpb-002). Same fix/rationale as app/api/invoices/statement/route.ts.
export const dynamic = 'force-dynamic';

interface LibraryProfileRow {
  id: string;
  name_en: string;
  profile_number: string;
}

// machine_profiles RLS requires auth.uid() IS NOT NULL even on
// is_public = true rows (see SCHEMA.md's MACHINE INTEGRATION TABLES) — so an
// anonymous FlashDraft visitor opening "Load from Library" can't read even
// the public rows through the normal session client. Same service-role
// bypass as app/studio/library/page.tsx; this route only ever returns public
// + active profiles, so no admin/private-visibility check is needed here.
export async function GET(): Promise<NextResponse> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('machine_profiles')
    .select('id, name_en, profile_number')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('name_en')
    .returns<LibraryProfileRow[]>();

  return NextResponse.json({ profiles: data ?? [] });
}
