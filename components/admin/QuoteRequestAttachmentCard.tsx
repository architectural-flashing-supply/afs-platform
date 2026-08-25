'use client';

import { useState } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';

// Renderable-as-<img> extensions. Blueprint Takeoff also accepts .pdf/.dwg/.dxf
// (lib/utils/upload-limits.ts) which browsers can't inline as an image — those
// fall back to a plain download link instead of a thumbnail.
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.tiff', '.tif'];

export interface QuoteRequestAttachment {
  fileName: string;
  fileType: string;
  signedUrl: string | null;
}

/**
 * Attachment viewer for the Command Center quote-request detail view
 * (afs-fl-008) — covers any quote_requests row with a non-null upload_id,
 * both the Blueprint Takeoff flow and field_photo_quote (afs-fl-007).
 * Thumbnail click opens the same signed URL at full resolution via
 * ImageLightbox — no separate downscaled thumbnail is ever generated.
 */
export default function QuoteRequestAttachmentCard({ fileName, fileType, signedUrl }: QuoteRequestAttachment) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isImage = IMAGE_EXTENSIONS.includes(fileType.toLowerCase());

  if (!signedUrl) {
    return (
      <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
        <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Attachment</h2>
        <p className="font-body text-sm text-afs-chrome-mid">{fileName} — could not generate a link.</p>
      </div>
    );
  }

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
      <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Attachment</h2>
      {isImage ? (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-40 aspect-square bg-afs-bg-overlay border border-afs-border rounded overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signedUrl} alt={fileName} className="w-full h-full object-cover" />
          </button>
          <p className="font-body text-xs text-afs-chrome-mid mt-2">{fileName} — click to inspect at full resolution</p>
          {lightboxOpen && <ImageLightbox src={signedUrl} alt={fileName} onClose={() => setLightboxOpen(false)} />}
        </>
      ) : (
        <a
          href={signedUrl}
          target="_blank"
          rel="noreferrer"
          className="font-body text-sm text-afs-crimson hover:text-afs-crimson-hover underline"
        >
          Download {fileName}
        </a>
      )}
    </div>
  );
}
