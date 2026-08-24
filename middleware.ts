import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceRoleClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Reads role via the service-role client (bypasses RLS) rather than the
// request-scoped session client — the session client's `profiles` read
// depends on RLS/cookie propagation timing in the Edge runtime, which is
// exactly what let non-admins (and even admins) get silently misrouted.
async function getUserRole(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await admin.from('profiles').select('role').eq('id', userId).single();
  if (error || !data) return null;
  return data.role as string;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAccountRoute = pathname.startsWith('/account');
  const isCheckoutRoute = pathname.startsWith('/checkout');
  const isAdminRoute = pathname.startsWith('/admin');
  const isFieldShopRoute = pathname.startsWith('/field/shop');
  const isAuthEntryRoute = pathname === '/login' || pathname === '/register';

  // Unauthenticated users cannot reach protected routes. /field/shop sends
  // unauthorized visitors to /field/no-access rather than /login — per
  // SPEC, signed-out is just one more "not admin" case, not a login prompt.
  // /field/contractor is deliberately NOT gated here — SPEC_PHOTO_TO_QUOTE_AI.md
  // specifies it for anonymous field contractors/superintendents with no AFS
  // account (afs-fl-007), the same guest-access pattern as /upload.
  if (!user) {
    if (isFieldShopRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/field/no-access';
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (isAccountRoute || isCheckoutRoute || isAdminRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // From here on, user is authenticated. Role is only ever needed for the
  // route classes below, so it's fetched at most once per request.
  if (isAdminRoute) {
    const role = await getUserRole(user.id);
    if (role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/account';
      return NextResponse.redirect(url);
    }
    // Admin confirmed — allow through, no redirect.
    return supabaseResponse;
  }

  if (isFieldShopRoute) {
    const role = await getUserRole(user.id);
    const allowed = role === 'admin';
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/field/no-access';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Already-authenticated users don't need the login/register entry points —
  // admins land on /admin, everyone else on /account.
  if (isAuthEntryRoute) {
    const role = await getUserRole(user.id);
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/account';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
