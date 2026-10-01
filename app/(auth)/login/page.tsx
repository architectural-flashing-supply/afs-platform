'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  authInputClass,
  authLabelClass,
  authButtonClass,
  authErrorClass,
  authSuccessClass,
} from '@/components/layout/AuthShell';

type LoginMode = 'password' | 'magic';

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: 'That link is invalid or has expired. Please try again.',
};

const NOTICE_MESSAGES: Record<string, string> = {
  password_updated: 'Password updated. Please sign in.',
};

function resolveSignInErrorMessage(message: string | undefined): string {
  const lower = (message ?? '').toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email first.';
  if (lower.includes('rate limit')) return 'Too many attempts. Try again in a few minutes.';
  return 'Sign in failed. Please try again.';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const errorParam = searchParams.get('error');
  const noticeParam = searchParams.get('notice');

  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam ? ERROR_MESSAGES[errorParam] ?? 'Sign in failed. Please try again.' : null
  );
  const [notice] = useState<string | null>(
    !errorParam && noticeParam ? NOTICE_MESSAGES[noticeParam] ?? null : null
  );

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setError(null);
    setMagicLinkSent(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !data.user) {
      setLoading(false);
      setError(resolveSignInErrorMessage(signInError?.message));
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    router.push(profile?.role === 'admin' ? '/admin' : redirectParam || '/account');
    router.refresh();
  };

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          redirectParam || '/account'
        )}`,
      },
    });

    setLoading(false);
    if (otpError) {
      setError('Sign in failed. Please try again.');
      return;
    }
    setMagicLinkSent(true);
  };

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-afs-chrome-high mb-1 text-center">Sign In</h1>
      <p className="font-body text-sm text-afs-chrome-mid text-center mb-8">Access your AFS account</p>

      {notice && (
        <div className={authSuccessClass}>
          <p className="font-body text-sm text-afs-chrome-high">{notice}</p>
        </div>
      )}

      {error && (
        <div className={authErrorClass}>
          <p className="font-body text-sm text-afs-chrome-high">{error}</p>
        </div>
      )}

      {mode === 'magic' && magicLinkSent ? (
        <div className="text-center">
          <p className="font-body text-sm text-afs-chrome-mid mb-2">
            Check your email. We sent a sign-in link to{' '}
            <span className="text-afs-chrome-high">{email}</span>.
          </p>
          <p className="font-body text-xs text-afs-chrome-silver">Link expires in 1 hour.</p>
        </div>
      ) : mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <div>
            <label className={authLabelClass} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-label text-xs uppercase tracking-widest text-afs-chrome-mid" htmlFor="password">
                Password
              </label>
              <Link href="/forgot-password" className="font-label text-xs text-afs-chrome-mid hover:text-afs-danger-on-dark">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <button
            type="button"
            data-testid="magic-link-toggle"
            onClick={() => switchMode('magic')}
            className="w-full text-center font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high py-2"
          >
            Sign in with magic link instead
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} className="space-y-5">
          <div>
            <label className={authLabelClass} htmlFor="magic-email">
              Email
            </label>
            <input
              id="magic-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="you@company.com"
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
          <button
            type="button"
            onClick={() => switchMode('password')}
            className="w-full text-center font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high py-2"
          >
            Sign in with password instead
          </button>
        </form>
      )}

      <p className="text-center font-body text-sm text-afs-chrome-mid mt-8">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-afs-danger-on-dark hover:text-afs-chrome-high">
          Create one
        </Link>
      </p>
      <p className="text-center font-body text-xs text-afs-chrome-silver mt-4">
        Applying for net terms?{' '}
        <Link href="/account/credit-application" className="text-afs-chrome-mid hover:text-afs-danger-on-dark underline">
          Apply for a credit account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
