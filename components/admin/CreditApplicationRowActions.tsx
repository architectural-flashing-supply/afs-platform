'use client';

import { useState } from 'react';
import type { CreditApplicationRow } from '@/lib/data/credit';
import CreditApplicationReviewModal from './CreditApplicationReviewModal';

export default function CreditApplicationRowActions({ application }: { application: CreditApplicationRow }) {
  const [reviewing, setReviewing] = useState(false);
  const reviewed = application.status === 'approved' || application.status === 'denied';

  return (
    <>
      <button
        type="button"
        onClick={() => setReviewing(true)}
        className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover border border-afs-border rounded px-3 py-1.5 transition-colors"
      >
        {reviewed ? 'View' : 'Review'}
      </button>
      {reviewing && (
        <CreditApplicationReviewModal application={application} onClose={() => setReviewing(false)} />
      )}
    </>
  );
}
