'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useRef } from 'react';
import type { V7Filter } from '@/lib/data/v7-view/types';

/**
 * v7's `.bar` — the one text field and the selects beside it, on Quotes,
 * Orders and Search.
 *
 * THERE IS NO APPLY BUTTON, AND REMOVING IT WAS THE POINT. The previous build
 * put one at the end of the row. v7 has none: typing filters as you type and a
 * select filters on change. An Apply button is an extra control in a row whose
 * widths are set by the design, so it both changes the look and adds a step.
 *
 * How it filters without one, on a server-rendered page: a select writes its
 * value into the query string and navigates; the text field does the same,
 * debounced, so a fast typist makes one navigation rather than one per
 * keystroke. `router.replace` rather than `push`, so filtering does not fill
 * the back button with every intermediate query — the same thing v7's in-place
 * re-render does.
 *
 * `?fixture=v7` is preserved across every one of those navigations. Without
 * that, changing a filter during a gate run would silently drop the page back
 * to live data mid-measurement.
 */
const DEBOUNCE_MS = 200;

export default function V7FilterBar({ filters }: { filters: V7Filter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback(
    (name: string, value: string) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      if (value) next.set(name, value);
      else next.delete(name);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  return (
    <div className="bar">
      {filters.map((f) => (
        <label key={f.name} className={f.options ? 'fld' : 'fld q'}>
          {f.label}
          {f.options ? (
            <select
              defaultValue={f.value}
              data-k={f.name}
              onChange={(e) => apply(f.name, e.target.value)}
            >
              {f.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <input
              defaultValue={f.value}
              placeholder={f.placeholder}
              autoComplete="off"
              onChange={(e) => {
                const v = e.target.value;
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => apply(f.name, v), DEBOUNCE_MS);
              }}
            />
          )}
        </label>
      ))}
    </div>
  );
}
