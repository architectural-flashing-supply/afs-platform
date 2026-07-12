'use client';

import { useState } from 'react';

interface NotificationSettingsFormProps {
  initialEmailOptIn: boolean;
  initialSmsOptIn: boolean;
}

export default function NotificationSettingsForm({ initialEmailOptIn, initialSmsOptIn }: NotificationSettingsFormProps) {
  const [emailOptIn, setEmailOptIn] = useState(initialEmailOptIn);
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: { emailOptIn?: boolean; smsOptIn?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/account/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not update preferences.');
      }
    } catch {
      setError('Could not update preferences.');
    } finally {
      setSaving(false);
    }
  }

  function toggleEmail() {
    const next = !emailOptIn;
    setEmailOptIn(next);
    void persist({ emailOptIn: next });
  }

  function toggleSms() {
    const next = !smsOptIn;
    setSmsOptIn(next);
    void persist({ smsOptIn: next });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="notification-settings-form">
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="font-body text-sm text-afs-chrome-high">Email Notifications</p>
          <p className="font-body text-xs text-afs-chrome-mid">Quote updates, order status changes, delivery alerts.</p>
        </div>
        <input
          type="checkbox"
          checked={emailOptIn}
          onChange={toggleEmail}
          disabled={saving}
          className="accent-afs-crimson w-5 h-5 shrink-0"
          aria-label="Toggle email notifications"
        />
      </label>
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <div>
          <p className="font-body text-sm text-afs-chrome-high">SMS Notifications</p>
          <p className="font-body text-xs text-afs-chrome-mid">Production updates and delivery text alerts.</p>
        </div>
        <input
          type="checkbox"
          checked={smsOptIn}
          onChange={toggleSms}
          disabled={saving}
          className="accent-afs-crimson w-5 h-5 shrink-0"
          aria-label="Toggle SMS notifications"
        />
      </label>
      {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
    </div>
  );
}
