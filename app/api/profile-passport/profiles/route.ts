import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPassportProfiles, getPassportUserContext } from '@/lib/data/profile-passport';

interface CreateProfileBody {
  profile_name?: string;
  category?: string | null;
  subcategory?: string;
  geometry_data?: { points?: unknown; hemStart?: unknown; hemEnd?: unknown };
  job_info?: Record<string, unknown>;
  /** `data:image/png;base64,...` canvas capture (025_profile_passport_thumbnail.sql) — optional, same field FlashDraft's own performSave writes directly. */
  thumbnail_image?: string | null;
}

/**
 * GET returns every profile visible to the caller — RLS
 * (024_profile_passport_company_scope.sql's profile_passport_select
 * policy) already restricts that to their own rows, or on a company
 * account, every teammate's rows too, per the Phase 3 spec's "account-wide
 * ownership" requirement.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const profiles = await getPassportProfiles(supabase);
  return NextResponse.json({ profiles });
}

/**
 * A second, API-driven way to create a saved profile alongside FlashDraft's
 * own direct-to-Supabase performSave (app/studio/draft/page.tsx) — this one
 * exists for anything outside FlashDraft that needs to save a profile
 * programmatically. company_id is ALWAYS taken from the caller's own
 * session-loaded profile, never the request body, so a client can't claim
 * a company it doesn't belong to.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateProfileBody | null;
  const points = body?.geometry_data?.points;
  if (!Array.isArray(points) || points.length < 2) {
    return NextResponse.json({ error: 'geometry_data.points must have at least 2 points.' }, { status: 400 });
  }

  const profileName = body?.profile_name?.trim() || `Profile-${new Date().toISOString()}`;

  const { data, error } = await supabase
    .from('saved_configurations')
    .insert({
      user_id: context.userId,
      company_id: context.companyId,
      name: profileName,
      is_locked: false,
      // Plain display labels (024_profile_passport_company_scope.sql) — NOT
      // the same thing as dimensions.categoryId below, which holds a value
      // from the curated AFS_PROFILE_CATEGORIES vocabulary. body.category is
      // caller-supplied free text here, so the two never mix.
      category: body?.category?.trim() || 'General',
      subcategory: body?.subcategory?.trim() || 'Custom',
      job_info: body?.job_info ?? null,
      thumbnail_image: body?.thumbnail_image ?? null,
      dimensions: {
        kind: 'flashdraft',
        points,
        hemStart: body?.geometry_data?.hemStart ?? null,
        hemEnd: body?.geometry_data?.hemEnd ?? null,
        categoryId: null,
        subcategory: body?.subcategory ?? 'Custom',
        revision: 1,
        isLocked: false,
      },
    })
    .select('id, name, created_at')
    .single();

  if (error || !data) {
    console.error('[Profile Passport Create Error]', error);
    return NextResponse.json({ error: 'Could not save profile.' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, name: data.name, created_at: data.created_at }, { status: 201 });
}
