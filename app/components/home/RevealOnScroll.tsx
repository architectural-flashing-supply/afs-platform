'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

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
}: {
  children: ReactNode;
  className?: string;
  // Lets callers preserve a semantic wrapper (e.g. <dl> for a stats list)
  // instead of always getting a generic <div> around their children.
  as?: 'div' | 'dl' | 'ol' | 'ul';
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

  return (
    <Component ref={ref} className={`reveal-group ${visible ? 'is-visible' : ''} ${className}`}>
      {children}
    </Component>
  );
}
