'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { authSuccessClass, authErrorClass } from '@/components/layout/AuthShell';

export default function RegisterConfirmPage() {
  const [email, setEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    setEmail(sessionStorage.getItem('afs_pending_confirm_email') ?? '');
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setResendError(null);
    setResendSuccess(false);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });

    if (error) {
      setResendError('Could not resend confirmation email. Please try again.');
      return;
    }
    setResendSuccess(true);
    setCooldown(60);
  };

  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--afs-crimson-ghost)] flex items-center justify-center mx-auto mb-6">
        <svg className="w-7 h-7 text-afs-danger-on-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h1 className="font-heading text-2xl font-bold text-afs-chrome-high mb-3">Check Your Email</h1>
      <p className="font-body text-sm text-afs-chrome-mid mb-8">
        We sent a confirmation link to{' '}
        {email ? <span className="text-afs-chrome-high">{email}</span> : 'your email address'}. Click the link
        to activate your account.
      </p>

      {resendError && (
        <div className={authErrorClass}>
          <p className="font-body text-sm text-afs-chrome-high">{resendError}</p>
        </div>
      )}
      {resendSuccess && (
        <div className={authSuccessClass}>
          <p className="font-body text-sm text-afs-chrome-high">Confirmation email resent.</p>
        </div>
      )}

      <button
        onClick={handleResend}
        disabled={cooldown > 0 || !email}
        className="font-label text-sm text-afs-chrome-mid hover:text-afs-chrome-high disabled:text-afs-chrome-silver disabled:cursor-not-allowed"
      >
        {cooldown > 0 ? `Resend confirmation email (${cooldown}s)` : 'Resend confirmation email'}
      </button>

      <p className="font-body text-sm text-afs-chrome-mid mt-8">
        Wrong email?{' '}
        <Link href="/register" className="text-afs-danger-on-dark hover:text-afs-chrome-high">
          Go back
        </Link>
      </p>
    </div>
  );
}
