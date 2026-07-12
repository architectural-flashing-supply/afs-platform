'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CancelInvitationButtonProps {
  invitationId: string;
  email: string;
}

export default function CancelInvitationButton({ invitationId, email }: CancelInvitationButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!window.confirm(`Cancel the pending invitation to ${email}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/team/invite?id=${invitationId}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson transition-colors disabled:opacity-50"
    >
      {loading ? 'Cancelling…' : 'Cancel Invitation'}
    </button>
  );
}
