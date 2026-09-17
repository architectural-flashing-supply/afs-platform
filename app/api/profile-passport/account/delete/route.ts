import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPassportUserContext } from '@/lib/data/profile-passport';

/**
 * "Delete Account" danger zone (Settings tab, Admin only per spec).
 * Deliberately scoped to the CALLING admin's own account only — not the
 * whole company or every teammate's access — since the spec doesn't
 * specify what "the account" means for a multi-person company, and
 * silently deleting teammates' logins along with it would be a far more
 * destructive default than a single admin most likely intends. profiles.id
 * REFERENCES auth.users(id) ON DELETE CASCADE (SCHEMA.md TABLE 1), so
 * deleting the auth user here also removes their profile row in the same
 * operation — orders/quotes/saved_configurations rows referencing this
 * user_id are NOT cascade-deleted (no ON DELETE CASCADE on those FKs),
 * so this does not erase this user's order/quote history, only their
 * ability to log in.
 *
 * UNTESTED: this session has no Supabase access to the real afs-website
 * project, so supabase.auth.admin.deleteUser() has never actually been
 * exercised against it here. Verify this carefully (ideally against a
 * disposable test account) before relying on it in production.
 */
export async function DELETE(): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  if (context.role !== 'admin') {
    return NextResponse.json({ error: 'Only Admins can delete an account.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(context.userId);
  if (error) {
    console.error('[Profile Passport Delete Account Error]', error);
    return NextResponse.json({ error: 'Could not delete account. Please try again.' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
