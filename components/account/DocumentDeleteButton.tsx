'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DocumentDeleteButtonProps {
  documentId: string;
  filename: string;
}

export default function DocumentDeleteButton({ documentId, filename }: DocumentDeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors disabled:opacity-50"
    >
      {loading ? 'Deleting…' : 'Delete'}
    </button>
  );
}
