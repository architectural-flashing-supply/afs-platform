import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Server/admin-generated links (auth.admin.generateLink, and any link built
  // server-side rather than by the browser client) have no PKCE code_verifier,
  // so GoTrue hands back an implicit-flow `#access_token=...` FRAGMENT, which a
  // browser never transmits to the server -- the `code` branch below can never
  // see it. The documented server-side counterpart is `token_hash` + `type`
  // verified with verifyOtp(). Both branches coexist: browser magic links
  // (signInWithOtp from lib/supabase/client.ts, PKCE by default) still arrive
  // as `?code=` and are unaffected. See STATE_OF_THE_BUILD.md's lr-01 entry.
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type') as EmailOtpType | null;
  const requestedNext = searchParams.get('next') ?? '/account';

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return NextResponse.redirect(`${origin}${await resolveNext(supabase, data.user.id, requestedNext)}`);
    }
  } else if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (!error && data.user) {
      return NextResponse.redirect(`${origin}${await resolveNext(supabase, data.user.id, requestedNext)}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

// Mirrors the password sign-in redirect in app/(auth)/login/page.tsx: admins
// always land on /admin regardless of the requested next page, since
// magic-link sign-in has no earlier point to know the role.
async function resolveNext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  requestedNext: string
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return profile?.role === 'admin' ? '/admin' : requestedNext;
}
