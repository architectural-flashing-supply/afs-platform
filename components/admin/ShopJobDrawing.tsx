'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ONE shop job's drawing, fetched LAZILY once the card scrolls into view.
 *
 * `shop_profile_library.geometry_svg` holds a base64 PNG data URI — measured
 * against the live database at 70KB to 786KB per row. Shop View is a list of
 * large cards that polls itself, so server-rendering those would put megabytes
 * of base64 into the HTML on every refresh. Each card fetches its own instead,
 * from app/api/admin/shop-queue/drawing/[id].
 *
 * The pattern, the IntersectionObserver margin and the "no image, no lie about
 * it" empty state all come from PastProfileThumb.tsx, which does the same job
 * for the Job screen's past-profile tiles. Two consumers, one approach.
 */
export default function ShopJobDrawing({
  id,
  hasDrawing,
  size,
}: {
  id: string;
  hasDrawing: boolean;
  size: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'empty'>(
    hasDrawing ? 'idle' : 'empty'
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || state !== 'idle') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setState('loading');
        fetch(`/api/admin/shop-queue/drawing/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { drawing?: string | null } | null) => {
            if (d?.drawing) {
              setImage(d.drawing);
              setState('done');
            } else {
              setState('empty');
            }
          })
          .catch(() => setState('empty'));
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, state]);

  return (
    <div
      ref={ref}
      style={{ width: size, height: size }}
      className="shrink-0 bg-afs-bg-light-raised border border-afs-border-light rounded-lg flex items-center justify-center overflow-hidden"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a base64 data
        // URI cannot go through next/image, which needs a real URL to optimise.
        <img
          src={image}
          alt="The profile being bent"
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span className="font-body text-sm text-afs-ink-700 px-2 text-center leading-tight">
          {state === 'empty' ? 'No drawing' : 'Loading…'}
        </span>
      )}
    </div>
  );
}
