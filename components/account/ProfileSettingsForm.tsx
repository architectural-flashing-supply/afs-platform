'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ProfileSettingsFormProps {
  email: string;
  initialFullName: string;
  initialCompany: string;
  initialPhone: string;
}

export default function ProfileSettingsForm({ email, initialFullName, initialCompany, initialPhone }: ProfileSettingsFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [company, setCompany] = useState(initialCompany);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, company, phone }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not update profile.');
        setLoading(false);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="profile-settings-form">
      <div>
        <label htmlFor="settings-email" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
          Email
        </label>
        <input
          id="settings-email"
          type="email"
          value={email}
          disabled
          className="w-full bg-afs-bg-dim border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-700 font-body cursor-not-allowed"
        />
      </div>
      <div>
        <label htmlFor="settings-name" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
          Full Name
        </label>
        <input
          id="settings-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
          required
        />
      </div>
      <div>
        <label htmlFor="settings-company" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
          Company
        </label>
        <input
          id="settings-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
        />
      </div>
      <div>
        <label htmlFor="settings-phone" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
          Phone
        </label>
        <input
          id="settings-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
        />
      </div>

      {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
      {saved && !error && <p className="font-body text-xs text-afs-success">Profile updated.</p>}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
