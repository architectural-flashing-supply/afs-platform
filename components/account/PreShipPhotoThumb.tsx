'use client';

import { useState } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';

/**
 * The pre-ship photo slot inside ProductionTimeline
 * (SPEC_PRODUCTION_TIMELINE.md §5: "Click → opens full size"). Split into its
 * own client component for one reason: ProductionTimeline must stay renderable
 * from a server component (the customer and admin order-detail pages) AND from
 * inside a client component (the public order-status lookup), so it cannot own
 * the `useState` a lightbox needs. A client child of a shared component is
 * fine in both directions; a `'use client'` directive on the timeline itself
 * would pull two server pages' worth of markup into the browser bundle for a
 * feature only one slot uses.
 *
 * The same signed URL is used for the thumbnail and the full-size view — no
 * downscaled derivative is generated anywhere in this codebase, matching
 * components/admin/QuoteRequestAttachmentCard.tsx.
 */
export default function PreShipPhotoThumb({ url, caption }: { url: string; caption: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="block max-w-xs rounded border border-afs-chrome-base overflow-hidden focus:outline-none focus:ring-2 focus:ring-afs-crimson"
        aria-label={`${caption} — open full size`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={caption} className="w-full h-auto object-cover" />
      </button>
      <p className="font-body text-xs text-afs-chrome-mid mt-2">{caption} — click to view full size</p>
      {lightboxOpen && <ImageLightbox src={url} alt={caption} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
