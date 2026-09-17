import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPassportUserContext } from '@/lib/data/profile-passport';

interface RenameBody {
  profile_name?: string;
}

/**
 * Only editable field in MVP is the name, per spec. Role check here is a
 * fast, explicit 403 before ever hitting the database — RLS
 * (profile_passport_update, 024_profile_passport_company_scope.sql) is the
 * real enforcement boundary and would reject a Viewer's write regardless,
 * but returning a clear 403 up front avoids relying on Postgres's "0 rows
 * affected" as the only signal a caller gets.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  if (context.role === 'viewer') {
    return NextResponse.json({ error: 'Viewers cannot edit profiles.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RenameBody | null;
  const profileName = body?.profile_name?.trim();
  if (!profileName) {
    return NextResponse.json({ error: 'profile_name is required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_configurations')
    .update({ name: profileName })
    .eq('id', params.id)
    .select('id, name')
    .maybeSingle();

  if (error) {
    console.error('[Profile Passport Rename Error]', error);
    return NextResponse.json({ error: 'Could not rename profile.' }, { status: 500 });
  }
  // A Viewer/Editor-below-threshold write, or a row outside this caller's
  // company, is blocked by RLS rather than surfaced as an application
  // error — Postgres just returns zero rows, which .maybeSingle() reports
  // as null data with no error. Treated as 404 rather than 403 here since
  // this route can't distinguish "doesn't exist" from "not visible to you"
  // (RLS deliberately hides the difference) and the role gate above already
  // caught the one case (Viewer) this app can otherwise identify.
  if (!data) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, name: data.name });
}

/** Admin (company_role owner/admin, or the sole owner of a no-company row) only, matching the spec's DELETE law literally. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  if (context.role !== 'admin') {
    return NextResponse.json({ error: 'Only Admins can delete profiles.' }, { status: 403 });
  }

  const { data, error } = await supabase.from('saved_configurations').delete().eq('id', params.id).select('id').maybeSingle();

  if (error) {
    console.error('[Profile Passport Delete Error]', error);
    return NextResponse.json({ error: 'Could not delete profile.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
