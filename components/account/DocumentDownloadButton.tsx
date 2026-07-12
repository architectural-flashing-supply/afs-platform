'use client';

import { useState } from 'react';

interface DocumentDownloadButtonProps {
  documentId: string;
  className?: string;
  label?: string;
}

interface DownloadResponse {
  signedUrl: string;
}

export default function DocumentDownloadButton({ documentId, className, label = 'Download' }: DocumentDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/download`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as DownloadResponse;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={
        className ??
        'font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors disabled:opacity-50'
      }
    >
      {loading ? 'Preparing…' : label}
    </button>
  );
}
