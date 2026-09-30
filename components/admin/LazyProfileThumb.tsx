'use client';

import { useEffect, useRef, useState } from 'react';
import { pointsToSvgPath } from '@/lib/data/job-screen';

/**
 * ONE saved profile's drawing, fetched only once it is actually on screen.
 *
 * `saved_configurations.thumbnail_image` is a base64 PNG that regularly
 * exceeds 100KB. A vertical rail of search results is the single worst place
 * to put those in a list payload — twenty results would be a couple of
 * megabytes of images for a screen the user is about to narrow down anyway.
 * So the list carries `hasThumbnail` and nothing else, and each tile asks for
 * its own picture from
 * /api/admin/command-center/profile-thumbnail/[id] when an
 * IntersectionObserver says it has come into view.
 *
 * This is the pattern PastProfileThumb.tsx established for the Job screen and
 * ShopJobDrawing.tsx for Shop View; v2-05 needed a third caller and pulled the
 * loading out here rather than copying it again. PastProfileThumb is now a
 * link wrapped around this component, so there is ONE implementation of the
 * lazy fetch and one place a bug in it could live.
 *
 * The response also carries `points`, so a profile saved before screenshots
 * were captured still draws as a real vector outline instead of an empty box.
 *
 * IN-MEMORY CACHE. The rail and the enlarged preview show the SAME profile at
 * two sizes, and arrowing up and down a list revisits tiles constantly. The
 * endpoint sets `Cache-Control: private, max-age=3600` so the browser would
 * not re-download, but a module-level map means the request is not made at
 * all. Keyed by id; a saved profile's drawing never changes in place (a
 * modification creates a new row — Part 1), so a stale entry is not possible.
 */

interface Loaded {
  image: string | null;
  path: string | null;
}

const cache = new Map<string, Loaded>();

export default function LazyProfileThumb({
  id,
  size = 56,
  /** Skip the observer — for the enlarged preview, which is created ON demand. */
  eager = false,
  className = '',
}: {
  id: string;
  size?: number;
  eager?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cached = cache.get(id);
  const [loaded, setLoaded] = useState<Loaded | null>(cached ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fromCache = cache.get(id);
    if (fromCache) {
      setLoaded(fromCache);
      setFailed(false);
      return;
    }
    setLoaded(null);
    setFailed(false);

    let cancelled = false;
    const load = () => {
      fetch(`/api/admin/command-center/profile-thumbnail/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { thumbnailImage?: string | null; points?: { x: number; y: number }[] | null } | null) => {
          if (cancelled) return;
          const entry: Loaded = {
            image: d?.thumbnailImage ?? null,
            path: Array.isArray(d?.points) ? pointsToSvgPath(d!.points!) : null,
          };
          cache.set(id, entry);
          setLoaded(entry);
          if (!entry.image && !entry.path) setFailed(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    };

    if (eager) {
      load();
      return () => {
        cancelled = true;
      };
    }

    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        load();
      },
      { rootMargin: '150px' }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [id, eager]);

  return (
    <div
      ref={ref}
      data-testid="profile-thumb"
      data-profile-id={id}
      data-thumb-state={loaded?.image ? 'image' : loaded?.path ? 'vector' : failed ? 'none' : 'pending'}
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight: size, minWidth: size }}
    >
      {loaded?.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a base64 data
        // URI cannot go through next/image, which needs a real URL to optimise.
        <img src={loaded.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      ) : loaded?.path ? (
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
          <path
            d={loaded.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-afs-ink-900"
          />
        </svg>
      ) : (
        <span className="font-body text-[11px] text-afs-ink-700 px-1 text-center leading-tight">
          {failed ? 'No drawing' : '…'}
        </span>
      )}
    </div>
  );
}
