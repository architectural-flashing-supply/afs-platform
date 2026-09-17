import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer-facing (any signed-in user, not admin-only) — Profile Passport
 * consolidates account identity + saved FlashDraft drawings (Phase 3,
 * afs-pp-001). Route is literally /app/profile-passport per the spec's own
 * explicit, repeated wording across all three entry points (main nav,
 * FlashDraft sidebar, this page) — unusual next to this codebase's other
 * prefixes (/account, /admin, /studio) but not a typo to "fix."
 */
export default async function ProfilePassportLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/app/profile-passport');

  return (
    <div className="min-h-screen bg-afs-bg-base">
      <div className="border-b border-afs-border px-6 pt-10">
        <div className="max-w-5xl mx-auto">
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Your Account</p>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Profile Passport</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1 mb-6 max-w-xl">
            Your saved profiles, account, and preferences in one place.
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
