'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isValidEmail } from '@/lib/utils/validation';
import { authInputClass, authLabelClass, authButtonClass, authErrorClass } from '@/components/layout/AuthShell';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    // Never confirm or deny whether the email exists — always proceed to the sent page.
    router.push('/forgot-password/sent');
  };

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-afs-chrome-high mb-1 text-center">Reset Password</h1>
      <p className="font-body text-sm text-afs-chrome-mid text-center mb-8">
        Enter your email and we&apos;ll send you a reset link
      </p>

      {error && (
        <div className={authErrorClass}>
          <p className="font-body text-sm text-afs-chrome-high">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
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
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center font-body text-sm text-afs-chrome-mid mt-8">
        Remembered your password?{' '}
        <Link href="/login" className="text-afs-danger-on-dark hover:text-afs-chrome-high">
          Sign in
        </Link>
      </p>
    </div>
  );
}
