'use client';

import Link from 'next/link';
import LazyProfileThumb from '@/components/admin/LazyProfileThumb';

/**
 * ONE past-profile tile on the Job screen — a link wrapped around the shared
 * lazy thumbnail loader.
 *
 * The loading itself (IntersectionObserver, the per-id fetch from
 * /api/admin/command-center/profile-thumbnail/[id], the vector fallback for a
 * profile saved before screenshots were captured) moved into
 * LazyProfileThumb.tsx in v2-05, when the Search rail became the third caller
 * that needed it. Behaviour here is unchanged: nothing base64 is server-
 * rendered into this page, and a tile that is never scrolled to never fetches
 * anything.
 *
 * Clicking opens the profile in FlashDraft through the existing
 * ?modifyProfile= contract.
 */
export default function PastProfileThumb({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/studio/draft?admin=1&modifyProfile=${id}`}
      title={name}
      aria-label={`Open ${name} in FlashDraft`}
      className="h-[72px] bg-afs-bg-light-raised border border-afs-border-light rounded flex items-center justify-center overflow-hidden hover:border-afs-line-strong"
    >
      <LazyProfileThumb id={id} size={56} className="h-full w-full" />
    </Link>
  );
}
