'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isStrongEnoughPassword } from '@/lib/utils/validation';
import {
  authInputClass,
  authLabelClass,
  authButtonClass,
  authErrorClass,
} from '@/components/layout/AuthShell';

type Mode = 'login' | 'register';

interface InviteAcceptFormProps {
  token: string;
  email: string;
  role: string;
  companyName: string;
  isLoggedIn: boolean;
  loggedInEmail: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  estimator: 'Estimator',
  pm: 'PM',
  accounting: 'Accounting',
  viewer: 'Viewer',
};

const disabledInputClass = `${authInputClass} opacity-60 cursor-not-allowed`;

export default function InviteAcceptForm({
  token,
  email,
  role,
  companyName,
  isLoggedIn,
  loggedInEmail,
}: InviteAcceptFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [autoAccepting, setAutoAccepting] = useState(isLoggedIn);

  async function acceptInvitation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not join the company.');
        setLoading(false);
        setAutoAccepting(false);
        return;
      }
      router.push('/account');
      router.refresh();
    } catch {
      setError('Could not join the company. Please try again.');
      setLoading(false);
      setAutoAccepting(false);
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return;
    if (loggedInEmail?.toLowerCase() !== email.toLowerCase()) {
      setAutoAccepting(false);
      setError(`You're signed in as ${loggedInEmail}. This invitation was sent to ${email}. Sign out and try again.`);
      return;
    }
    void acceptInvitation();
    // Runs once on mount to accept the invitation for the already-authenticated matching user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setLoading(false);
      setError('Email or password is incorrect.');
      return;
    }
    await acceptInvitation();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!isStrongEnoughPassword(password)) {
      setError('Password must be at least 8 characters and include a number or symbol.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, accountType: 'other' }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }
      setRegistered(true);
      setLoading(false);
    } catch {
      setError('Registration failed. Please try again.');
      setLoading(false);
    }
  }

  if (autoAccepting) {
    return (
      <div className="text-center py-8">
        <p className="font-body text-sm text-afs-ink-700">Joining {companyName}…</p>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="text-center">
        <h1 className="font-heading text-2xl text-afs-ink-900 mb-3">Confirm Your Email</h1>
        <p className="font-body text-sm text-afs-ink-700 mb-2">
          We sent a confirmation link to <span className="text-afs-ink-900">{email}</span>.
        </p>
        <p className="font-body text-sm text-afs-ink-700">
          After confirming, come back to this invitation link to finish joining {companyName}.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-afs-ink-900 mb-1 text-center">Join {companyName}</h1>
      <p className="font-body text-sm text-afs-ink-700 text-center mb-8">
        You&apos;ve been invited as <span className="text-afs-ink-900">{ROLE_LABEL[role] ?? role}</span>
      </p>

      {error && (
        <div className={authErrorClass}>
          <p className="font-body text-sm text-afs-ink-900">{error}</p>
        </div>
      )}

      <div className="flex gap-2 mb-6 justify-center" data-testid="invite-mode-tabs">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
            mode === 'login'
              ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
              : 'border-afs-chrome-dim text-afs-ink-700 hover:bg-afs-bg-surface'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
            mode === 'register'
              ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
              : 'border-afs-chrome-dim text-afs-ink-700 hover:bg-afs-bg-surface'
          }`}
        >
          Create Account
        </button>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className={authLabelClass} htmlFor="invite-login-email">
              Email
            </label>
            <input id="invite-login-email" type="email" value={email} disabled className={disabledInputClass} />
          </div>
          <div>
            <label className={authLabelClass} htmlFor="invite-login-password">
              Password
            </label>
            <input
              id="invite-login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Signing In…' : 'Sign In & Join'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className={authLabelClass} htmlFor="invite-register-name">
              Full Name
            </label>
            <input
              id="invite-register-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={authInputClass}
              placeholder="Jane Contractor"
            />
          </div>
          <div>
            <label className={authLabelClass} htmlFor="invite-register-email">
              Email
            </label>
            <input id="invite-register-email" type="email" value={email} disabled className={disabledInputClass} />
          </div>
          <div>
            <label className={authLabelClass} htmlFor="invite-register-password">
              Password
            </label>
            <input
              id="invite-register-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className={authButtonClass}>
            {loading ? 'Creating Account…' : 'Create Account & Join'}
          </button>
        </form>
      )}
    </div>
  );
}
