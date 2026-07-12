'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPasswordStrength } from '@/lib/utils/password-strength';
import { isValidEmail, isStrongEnoughPassword } from '@/lib/utils/validation';
import { authInputClass, authLabelClass, authButtonClass, authErrorClass } from '@/components/layout/AuthShell';

type AccountType = 'contractor' | 'architect' | 'pm_gc' | 'other';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'contractor', label: 'Contractor' },
  { value: 'architect', label: 'Architect / Specifier' },
  { value: 'pm_gc', label: 'Project Manager / GC' },
  { value: 'other', label: 'Other' },
];

const STRENGTH_LABEL: Record<string, string> = { weak: 'Weak', fair: 'Fair', strong: 'Strong' };
const STRENGTH_COLOR: Record<string, string> = {
  weak: 'text-afs-crimson',
  fair: 'text-afs-warning',
  strong: 'text-afs-success',
};
const STRENGTH_BAR: Record<string, string> = {
  weak: 'w-1/3 bg-afs-crimson',
  fair: 'w-2/3 bg-afs-warning',
  strong: 'w-full bg-afs-success',
};

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => (password ? getPasswordStrength(password) : null), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!isStrongEnoughPassword(password)) {
      setError('Password must be at least 8 characters and include a number or symbol.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!accountType) {
      setError('Select an account type.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, company, accountType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }
      sessionStorage.setItem('afs_pending_confirm_email', email);
      router.push('/register/confirm');
    } catch {
      setError('Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-afs-chrome-high mb-1 text-center">Create Account</h1>
      <p className="font-body text-sm text-afs-chrome-base text-center mb-8">
        Submit drawings, request quotes, and track orders online
      </p>

      {error && (
        <div className={authErrorClass}>
          <p className="font-body text-sm text-afs-chrome-high">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={authLabelClass} htmlFor="fullName">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={authInputClass}
            placeholder="Jane Contractor"
          />
        </div>

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
          <label className={authLabelClass} htmlFor="company">
            Company <span className="normal-case text-afs-chrome-dim">(optional)</span>
          </label>
          <input
            id="company"
            name="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={authInputClass}
            placeholder="ABC Roofing"
          />
        </div>

        <div>
          <label className={authLabelClass} htmlFor="password">
            Password
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
          {password && strength && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded-full bg-afs-bg-overlay overflow-hidden">
                <div className={`h-full rounded-full transition-all ${STRENGTH_BAR[strength]}`} />
              </div>
              <span
                data-testid="strength-label"
                className={`font-label text-xs uppercase tracking-wide ${STRENGTH_COLOR[strength]}`}
              >
                {STRENGTH_LABEL[strength]}
              </span>
            </div>
          )}
        </div>

        <div>
          <span className={authLabelClass}>Account Type</span>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {ACCOUNT_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex items-center gap-2 border rounded px-3 py-2.5 cursor-pointer font-body text-sm transition-colors ${
                  accountType === type.value
                    ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                    : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="accountType"
                  value={type.value}
                  checked={accountType === type.value}
                  onChange={() => setAccountType(type.value)}
                  className="accent-afs-crimson"
                />
                {type.label}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center font-body text-sm text-afs-chrome-base mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-afs-crimson hover:text-afs-crimson-hover">
          Sign in
        </Link>
      </p>
    </div>
  );
}
