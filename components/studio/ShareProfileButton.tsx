'use client';

import { useState } from 'react';

export default function ShareProfileButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // button just won't show the "Copied!" confirmation.
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="font-label text-xs font-semibold px-4 py-2 rounded border border-afs-chrome-dim text-afs-chrome-high bg-afs-bg-overlay hover:bg-afs-bg-surface transition-colors"
    >
      {copied ? 'Link Copied!' : 'Share'}
    </button>
  );
}
