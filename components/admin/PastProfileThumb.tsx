'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { pointsToSvgPath } from '@/lib/data/job-screen';

/**
 * ONE past-profile thumbnail, fetched LAZILY.
 *
 * `saved_configurations.thumbnail_image` is a base64 PNG that regularly exceeds
 * 100KB. The Job screen shows up to eight of a customer's past profiles, so
 * server-rendering them would put nearly a megabyte of base64 into the HTML of
 * a page that might never be scrolled. Instead each tile fetches its own image
 * from the pre-existing /api/admin/command-center/profile-thumbnail/[id] route
 * only once it actually scrolls into view — which is the exact reason that route
 * was built (see its own header).
 *
 * The route also returns `points`, so a profile saved before screenshots were
 * captured still draws as a real vector outline rather than an empty box.
 *
 * Clicking opens the profile in FlashDraft through the existing
 * ?modifyProfile= contract.
 */
export default function PastProfileThumb({ id, name }: { id: string; name: string }) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'empty'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || state !== 'idle') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setState('loading');
        fetch(`/api/admin/command-center/profile-thumbnail/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { thumbnailImage?: string | null; points?: { x: number; y: number }[] | null } | null) => {
            if (d?.thumbnailImage) {
              setImage(d.thumbnailImage);
              setState('done');
              return;
            }
            const p = Array.isArray(d?.points) ? pointsToSvgPath(d!.points!) : null;
            setPath(p);
            setState(p ? 'done' : 'empty');
          })
          .catch(() => setState('empty'));
      },
      { rootMargin: '150px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, state]);

  return (
    <Link
      ref={ref}
      href={`/studio/draft?admin=1&modifyProfile=${id}`}
      title={name}
      aria-label={`Open ${name} in FlashDraft`}
      className="h-[72px] bg-afs-bg-light-raised border border-afs-border-light rounded flex items-center justify-center overflow-hidden hover:border-afs-line-strong"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a base64 data
        // URI cannot go through next/image, which needs a real URL to optimise.
        <img src={image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      ) : path ? (
        <svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">
          <path d={path} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="text-afs-ink-900" />
        </svg>
      ) : (
        <span className="font-body text-[11px] text-afs-ink-700 px-1 text-center leading-tight">
          {state === 'empty' ? 'No drawing' : '…'}
        </span>
      )}
    </Link>
  );
}
