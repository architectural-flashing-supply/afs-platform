'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isStrongEnoughPassword } from '@/lib/utils/validation';
import { authInputClass, authLabelClass, authButtonClass, authErrorClass } from '@/components/layout/AuthShell';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isStrongEnoughPassword(password)) {
      setError('Password must be at least 8 characters and include a number or symbol.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError('Could not update password. Please request a new reset link.');
      return;
    }

    await supabase.auth.signOut();
    router.push('/login?notice=password_updated');
  };

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-afs-chrome-high mb-1 text-center">Set New Password</h1>
      <p className="font-body text-sm text-afs-chrome-mid text-center mb-8">
        Choose a new password for your account
      </p>

      {error && (
        <div className={authErrorClass}>
          <p className="font-body text-sm text-afs-chrome-high">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={authLabelClass} htmlFor="password">
            New Password
          </label>
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
        <div>
          <label className={authLabelClass} htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={authInputClass}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
