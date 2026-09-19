'use client';

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

// Viewport-triggered entrance animation with staggered child reveals
// (2026-09-19 revision pass, item 10). framer-motion isn't installed in
// this project, so this is the "small IntersectionObserver + CSS hook"
// fallback the spec explicitly allows instead. Wrap a group of elements
// (e.g. a grid of cards, a row of stat blocks) in this component -- each
// DIRECT CHILD fades in + rises 16-24px on its own staggered delay via the
// .reveal-group CSS in app/globals.css, once, the first time this section
// scrolls into view. Fully inert under prefers-reduced-motion (children
// render at their final state immediately, no transition).
export default function RevealOnScroll({
  children,
  className = '',
  as: Tag = 'div',
  durationMs,
  staggerMs,
}: {
  children: ReactNode;
  className?: string;
  // Lets callers preserve a semantic wrapper (e.g. <dl> for a stats list)
  // instead of always getting a generic <div> around their children.
  as?: 'div' | 'dl' | 'ol' | 'ul';
  // Per-instance timing override (2026-09-19 revision pass #2, item 1) --
  // the hero needs ~600ms/~120ms instead of every other section's
  // ~500ms/~80ms default. Applied as CSS custom properties consumed by
  // .reveal-group in globals.css; omitted entirely (undefined) falls
  // through to that file's own hardcoded defaults, so every existing
  // caller is byte-for-byte unaffected -- "same timing tokens as last
  // run" for anything that doesn't pass these.
  durationMs?: number;
  staggerMs?: number;
}) {
  // ElementType (not `any`) -- React's own typed escape hatch for a
  // polymorphic "as" tag. The `as unknown as` double-assertion (rather
  // than a plain `: ElementType = Tag` annotation) is deliberate: without
  // it, JSX still resolved this element's props/ref against Tag's own
  // narrow 'div'|'dl'|'ol'|'ul' union (TS tracks a const's literal
  // initializer type through JSX tag resolution even when the variable is
  // annotated wider), which then demanded the *intersection* of every
  // element's distinct ref type -- impossible to satisfy for any single
  // ref. Routing through `unknown` first breaks that literal-type
  // carryover.
  const Component = Tag as unknown as ElementType;
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motionQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleChange);
    return () => motionQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const style =
    durationMs !== undefined || staggerMs !== undefined
      ? ({
          ...(durationMs !== undefined && { '--reveal-duration': `${durationMs}ms` }),
          ...(staggerMs !== undefined && { '--reveal-stagger': `${staggerMs}ms` }),
        } as React.CSSProperties)
      : undefined;

  return (
    <Component
      ref={ref}
      className={`reveal-group ${visible ? 'is-visible' : ''} ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
}
