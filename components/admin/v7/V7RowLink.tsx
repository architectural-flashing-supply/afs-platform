'use client';

import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

/**
 * v7's CLICKABLE ROW — `<article class="lr" data-go="job:N">`.
 *
 * WHY NOT A LINK AROUND THE CUSTOMER NAME, which is what this was first. v7's
 * row has `<b>Hill Country Roofing</b>` as plain text and makes the whole
 * article clickable through its event delegate. Wrapping the name in an anchor
 * renders identically but adds an element v7 does not have — the structure gate
 * reported one extra landmark PER ROW on both lists, which is the kind of
 * quiet divergence this whole rebuild exists to stop.
 *
 * KEYBOARD ACCESS IS NOT LOST BY DOING IT v7's WAY. Every row already ends with
 * a real `<button>`/`<a>` in `.c6` — "Start quote", "Follow up", "Send to
 * machine", "Shop View", "Reorder" — and that is the focusable, announced path
 * to the same job. The row click is the mouse convenience on top, exactly as in
 * the prototype. So this element is deliberately NOT given `tabIndex` or a
 * `role`: a focusable div announcing itself as a link, duplicating a button
 * three columns along, is worse for a screen reader than plain text is.
 *
 * `?fixture=v7` rides along, so clicking a row mid-gate-run does not drop the
 * next page back to live data.
 */
export default function V7RowLink({
  href,
  className,
  children,
  testId,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const fixture = params?.get('fixture') === 'v7';

  return (
    <article
      className={className}
      data-testid={testId}
      onClick={(e) => {
        // Let a real control inside the row do its own job.
        if ((e.target as HTMLElement).closest('a,button,input,select,textarea')) return;
        router.push(fixture ? `${href}${href.includes('?') ? '&' : '?'}fixture=v7` : href);
      }}
    >
      {children}
    </article>
  );
}
