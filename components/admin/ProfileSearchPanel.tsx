'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_MATERIALS } from '@/lib/data/catalog';
import {
  SEARCH_FIELDS,
  SEARCH_FIELD_LABELS,
  statusLabel,
  type ProfileSearchResult,
  type SearchField,
} from '@/lib/data/profile-search';
import { createHoverIntent, type HoverIntent } from '@/lib/ui/hover-intent';
import LazyProfileThumb from '@/components/admin/LazyProfileThumb';

/**
 * FIND A PAST PROFILE — the approved prototype's `searchView`, built on the
 * server side commit 1646746 already delivered (Command Center V2 prompt
 * v2-05).
 *
 * =================== WHAT THIS DOES NOT DO ===================
 *
 * It does not query anything. Every result on this screen comes from
 * GET /api/admin/command-center/profile-search, which calls the parameterized
 * Postgres function `admin_profile_search` (migration 029) — and Recent and
 * Pinned come from the SAME function through the id list migration 038 added
 * to it. There is deliberately no second query layer here: this file is
 * presentation and interaction, nothing else.
 *
 * =================== EGRESS ===================
 *
 * The search response carries `hasThumbnail` and NO image data — the database
 * function does not have `thumbnail_image` in its return type, so there is
 * nothing for this component to accidentally render from a list payload. Each
 * tile asks for its own picture only once it is on screen (LazyProfileThumb).
 * A rail of twenty results downloads twenty small requests as you scroll, not
 * two megabytes of base64 up front.
 *
 * There is no polling on this screen at all — search runs when the user types
 * — so there is nothing to pause when the tab is hidden.
 *
 * =================== THE PREVIEW HAS NO CLOSE BUTTON ===================
 *
 * That is the approved design, and it is the reason the hover timing is a
 * tested state machine (lib/ui/hover-intent.ts) rather than two inline
 * setTimeouts: with no X to press, the ways out have to be completely
 * reliable. Move the pointer away and leave it away (300 ms grace, so the
 * journey across the gap onto the preview never closes it), press Escape, or
 * look at something else.
 *
 * =================== NOT A MOUSE-ONLY SCREEN ===================
 *
 * Hover is one of three ways in, not the way in:
 *   MOUSE     settle on a thumbnail for 150 ms.
 *   KEYBOARD  "/" focuses the box; Up/Down walk the rail and preview as they
 *             go; Enter jumps to Select; Escape closes.
 *   TOUCH     tap a thumbnail to preview it, then tap Select. A tap never
 *             waits out the hover delay — a tap is not ambiguous.
 */

const DEBOUNCE_MS = 250;

/** Anything shorter matches half the library and is not what anyone meant. */
const MIN_QUERY_LENGTH = 2;

export interface ProfileSearchPanelProps {
  initialQuery?: string;
  /**
   * What Select does. Omitted on the standalone Search page, where the
   * default is to open the profile in FlashDraft as a linked new draft.
   * FlashDraft supplies its own, because there it has to auto-save the canvas
   * first.
   */
  onSelect?: (profile: ProfileSearchResult) => void | Promise<void>;
  /** One line under Select, e.g. FlashDraft's auto-save promise. */
  selectNote?: string;
  /** Focus the search box on mount (the drawer does; the page does not steal focus). */
  autoFocusInput?: boolean;
}

interface RailGroup {
  key: string;
  label: string | null;
  emptyText: string;
  items: ProfileSearchResult[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function specLine(p: ProfileSearchResult): string {
  const parts = [p.material, p.gauge].filter(Boolean) as string[];
  if (p.lengthFt) parts.push(`${p.lengthFt} ft`);
  return parts.length ? parts.join(', ') : 'No spec recorded';
}

export default function ProfileSearchPanel({
  initialQuery = '',
  onSelect,
  selectNote,
  autoFocusInput = false,
}: ProfileSearchPanelProps) {
  const router = useRouter();

  const [q, setQ] = useState(initialQuery);
  const [field, setField] = useState<SearchField>('all');
  const [material, setMaterial] = useState('');

  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recent, setRecent] = useState<ProfileSearchResult[]>([]);
  const [pinned, setPinned] = useState<ProfileSearchResult[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectRef = useRef<HTMLButtonElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------ hover intent
  const intentRef = useRef<HoverIntent | null>(null);
  if (intentRef.current === null) {
    intentRef.current = createHoverIntent({
      onOpen: (id) => setActiveId(id),
      onClose: () => setActiveId(null),
    });
  }
  const intent = intentRef.current;
  useEffect(() => () => intentRef.current?.dispose(), []);

  // ------------------------------------------------------------ shortcuts
  const loadShortcuts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/command-center/profile-shortcuts', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        recent?: ProfileSearchResult[];
        pinned?: ProfileSearchResult[];
        pinnedIds?: string[];
      };
      setRecent(data.recent ?? []);
      setPinned(data.pinned ?? []);
      setPinnedIds(data.pinnedIds ?? []);
    } catch {
      // Recent and Pinned are conveniences. If they cannot be read the search
      // box still works, and saying so would be noise.
    }
  }, []);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  // ------------------------------------------------------------ the search
  const query = q.trim();
  const showingShortcuts = query.length < MIN_QUERY_LENGTH && material === '';

  useEffect(() => {
    if (showingShortcuts) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(() => {
      setSearching(true);
      setError(null);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('field', field);
      if (material) params.set('material', material);
      fetch(`/api/admin/command-center/profile-search?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          return (await res.json()) as { results?: ProfileSearchResult[] };
        })
        .then((data) => {
          setResults(data.results ?? []);
          setSearched(true);
          setSearching(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError('Search could not run just now. Try again in a moment.');
          setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, field, material, showingShortcuts]);

  // ------------------------------------------------------------ what's on screen
  const groups: RailGroup[] = useMemo(() => {
    if (showingShortcuts) {
      return [
        { key: 'pinned', label: 'Pinned', emptyText: 'Nothing pinned yet.', items: pinned },
        { key: 'recent', label: 'Recent', emptyText: 'Nothing opened yet.', items: recent },
      ];
    }
    return [{ key: 'results', label: null, emptyText: 'No matches. Try a shorter word.', items: results }];
  }, [showingShortcuts, pinned, recent, results]);

  /**
   * The rail top to bottom, deduplicated — a profile that is both pinned and
   * recent appears in both groups, and arrow-key navigation must not visit the
   * same id twice or Down would appear to stick.
   */
  const order = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const g of groups) {
      for (const item of g.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        ids.push(item.id);
      }
    }
    return ids;
  }, [groups]);

  const active = useMemo(() => {
    if (!activeId) return null;
    for (const g of groups) {
      const hit = g.items.find((i) => i.id === activeId);
      if (hit) return hit;
    }
    return null;
  }, [activeId, groups]);

  // A preview left open over a profile that is no longer in the rail would be
  // a panel about nothing, with no close button to get rid of it.
  useEffect(() => {
    if (activeId && !order.includes(activeId)) intent.closeNow();
  }, [activeId, order, intent]);

  // ------------------------------------------------------------ "/" focuses the box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ------------------------------------------------------------ actions
  function focusItem(id: string): void {
    const el = railRef.current?.querySelector<HTMLButtonElement>(`[data-rail-id="${id}"]`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }

  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape') {
      if (activeId) {
        const id = activeId;
        intent.closeNow();
        focusItem(id);
        e.preventDefault();
      }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (order.length === 0) return;
    const el = document.activeElement as HTMLElement | null;
    // Anchor on the focused rail item, or — if focus has moved into the
    // preview — on whatever the preview is showing.
    const anchor = el?.getAttribute('data-rail-id') ?? activeId;
    const at = anchor ? order.indexOf(anchor) : -1;
    const next =
      at === -1
        ? 0
        : e.key === 'ArrowDown'
          ? Math.min(at + 1, order.length - 1)
          : Math.max(at - 1, 0);
    e.preventDefault();
    const id = order[next];
    intent.openNow(id);
    focusItem(id);
  }

  async function recordOpen(id: string): Promise<void> {
    try {
      await fetch('/api/admin/command-center/profile-shortcuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', profileId: id }),
      });
    } catch {
      // Recent is a convenience; failing to record an open must never stop
      // the thing the user actually asked for.
    }
  }

  async function handleSelect(profile: ProfileSearchResult): Promise<void> {
    setBusyId(profile.id);
    setNotice(null);
    try {
      await recordOpen(profile.id);
      if (onSelect) {
        await onSelect(profile);
      } else {
        router.push(`/studio/draft?admin=1&modifyProfile=${profile.id}`);
      }
    } catch {
      setNotice('Could not open that profile. Nothing was changed.');
    } finally {
      setBusyId(null);
    }
  }

  async function togglePin(profile: ProfileSearchResult): Promise<void> {
    const isPinned = pinnedIds.includes(profile.id);
    setBusyId(profile.id);
    try {
      await fetch('/api/admin/command-center/profile-shortcuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isPinned ? 'unpin' : 'pin', profileId: profile.id }),
      });
      await loadShortcuts();
    } catch {
      setNotice('Could not change that pin.');
    } finally {
      setBusyId(null);
    }
  }

  // ------------------------------------------------------------ render
  const totalShown = order.length;
  const countLine = showingShortcuts
    ? 'Type at least two letters to search. Your pinned and recent profiles are below.'
    : searching
      ? 'Searching…'
      : `${results.length} ${results.length === 1 ? 'profile' : 'profiles'} found. Hover, tap, or use the arrow keys to preview one.`;

  return (
    <div
      className="grid gap-5 lg:grid-cols-[300px_220px_minmax(0,1fr)]"
      onKeyDown={onPanelKeyDown}
      data-testid="profile-search-panel"
    >
      {/* ---------------------------------------------------- the controls */}
      <div className="bg-afs-bg-card border border-afs-border-light rounded p-4 self-start">
        <div className="mb-4">
          <label htmlFor="profile-search-q" className="block font-label text-sm font-semibold text-afs-ink-900 mb-1">
            Search
          </label>
          <input
            id="profile-search-q"
            ref={inputRef}
            type="search"
            value={q}
            autoFocus={autoFocusInput}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try drip, Mike, or coping"
            /* Placeholder is BODY TEXT on a light surface: ink-700 at 10.3:1
               on bg-card (CLAUDE.md rule #23). chrome-silver would be 1.55:1
               here — it is the gunmetal answer, not this one. */
            className="w-full h-12 bg-afs-bg-card border border-afs-line-strong rounded px-3 font-body text-base text-afs-ink-900 placeholder:text-afs-ink-700 focus:outline-none focus:border-afs-crimson focus:ring-2 focus:ring-afs-crimson"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="profile-search-field" className="block font-label text-sm font-semibold text-afs-ink-900 mb-1">
            Search in
          </label>
          <select
            id="profile-search-field"
            value={field}
            onChange={(e) => setField(e.target.value as SearchField)}
            className="w-full h-12 bg-afs-bg-card border border-afs-line-strong rounded px-2 font-body text-base text-afs-ink-900 focus:outline-none focus:border-afs-crimson focus:ring-2 focus:ring-afs-crimson"
          >
            {SEARCH_FIELDS.map((f) => (
              <option key={f} value={f}>
                {SEARCH_FIELD_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="profile-search-material" className="block font-label text-sm font-semibold text-afs-ink-900 mb-1">
            Material
          </label>
          <select
            id="profile-search-material"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full h-12 bg-afs-bg-card border border-afs-line-strong rounded px-2 font-body text-base text-afs-ink-900 focus:outline-none focus:border-afs-crimson focus:ring-2 focus:ring-afs-crimson"
          >
            <option value="">Any material</option>
            {ALL_MATERIALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <p className="font-body text-sm text-afs-ink-700" data-testid="search-count" aria-live="polite">
          {countLine}
        </p>
        <p className="font-body text-xs text-afs-ink-700 mt-3">
          Press <kbd className="font-data border border-afs-line-strong rounded px-1">/</kbd> to jump back to the
          search box. Arrow keys walk the list, Enter opens the buttons, Escape closes the preview.
        </p>
        {error && (
          <p className="font-body text-sm text-afs-crimson mt-3" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="font-body text-sm text-afs-amber-ink bg-afs-amber-bg rounded px-2 py-1 mt-3" role="status">
            {notice}
          </p>
        )}
      </div>

      {/* ------------------------------------------- the vertical thumbnail rail */}
      <div
        ref={railRef}
        className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1"
        role="listbox"
        aria-label="Profiles"
        data-testid="profile-rail"
      >
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-3">
            {g.label && (
              <h2 className="font-label text-xs uppercase tracking-wide text-afs-ink-700 sticky top-0 bg-afs-bg-band py-1">
                {g.label}
              </h2>
            )}
            {g.items.length === 0 ? (
              <p className="font-body text-sm text-afs-ink-700">{g.emptyText}</p>
            ) : (
              g.items.map((p) => {
                const isActive = p.id === activeId;
                return (
                  <button
                    key={`${g.key}-${p.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-rail-id={p.id}
                    data-testid="rail-item"
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'touch') return;
                      intent.pointerEnterItem(p.id);
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'touch') return;
                      intent.pointerLeaveItem();
                    }}
                    onPointerDown={(e) => {
                      // A tap is not ambiguous — no hover delay for touch.
                      if (e.pointerType === 'touch') intent.openNow(p.id);
                    }}
                    onClick={() => {
                      intent.openNow(p.id);
                      // Put Select one press away for keyboard and touch alike.
                      requestAnimationFrame(() => selectRef.current?.focus());
                    }}
                    onFocus={() => intent.openNow(p.id)}
                    className={`shrink-0 min-h-[112px] w-full bg-afs-bg-card rounded p-2 flex flex-col items-center gap-1 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-afs-crimson ${
                      isActive
                        ? 'border-2 border-afs-crimson'
                        : 'border border-afs-border-light hover:border-afs-line-strong'
                    }`}
                  >
                    <LazyProfileThumb id={p.id} size={64} className="h-[64px] w-full text-afs-ink-900" />
                    <span className="font-label text-[13px] font-semibold text-afs-ink-900 leading-tight break-words">
                      {p.name}
                    </span>
                    {p.sameShapeCount > 1 && (
                      <span className="font-label text-[10px] uppercase tracking-wide text-afs-green-ink bg-afs-green-soft rounded px-1.5 py-0.5">
                        Same shape used {p.sameShapeCount}&times;
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        ))}
        {!showingShortcuts && searched && results.length === 0 && !searching && (
          <p className="font-body text-sm text-afs-ink-700" data-testid="no-matches">
            No matches. Try a shorter word.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------- the preview */}
      <div>
        {active ? (
          <section
            data-testid="profile-preview"
            aria-label={`Preview of ${active.name}`}
            onPointerEnter={(e) => {
              if (e.pointerType === 'touch') return;
              intent.pointerEnterPreview();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'touch') return;
              intent.pointerLeavePreview();
            }}
            className="bg-afs-bg-card border border-afs-border-light rounded p-5"
          >
            {/* No close button, by design — see this file's header. */}
            <div className="bg-afs-bg-light-raised rounded min-h-[260px] flex items-center justify-center mb-4">
              <LazyProfileThumb id={active.id} size={240} eager className="h-[260px] w-full text-afs-ink-900" />
            </div>

            <h2 className="font-heading text-2xl text-afs-ink-900">{active.name}</h2>

            <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1 mt-3 font-body text-[15px]">
              <dt className="text-afs-ink-700">Customer</dt>
              <dd className="text-afs-ink-900">{active.company ?? 'Not recorded'}</dd>
              <dt className="text-afs-ink-700">Person</dt>
              <dd className="text-afs-ink-900">{active.person ?? 'Not recorded'}</dd>
              <dt className="text-afs-ink-700">Type</dt>
              <dd className="text-afs-ink-900">{active.profileType ?? 'Untyped'}</dd>
              <dt className="text-afs-ink-700">Material</dt>
              <dd className="text-afs-ink-900">{specLine(active)}</dd>
              <dt className="text-afs-ink-700">Last made</dt>
              <dd className="text-afs-ink-900">{formatDate(active.createdAt)}</dd>
              {statusLabel(active.status) && (
                <>
                  <dt className="text-afs-ink-700">Status</dt>
                  <dd className="text-afs-ink-900">
                    {statusLabel(active.status)}
                    {active.pathfinderProfileId && (
                      <span className="font-data text-sm text-afs-ink-700"> · profile #{active.pathfinderProfileId}</span>
                    )}
                  </dd>
                </>
              )}
            </dl>

            {active.sameShapeCount > 1 && (
              <p className="font-label text-sm text-afs-green-ink bg-afs-green-soft rounded px-2 py-1 mt-3 inline-block">
                Same shape used {active.sameShapeCount}&times;
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                ref={selectRef}
                data-testid="profile-select"
                disabled={busyId === active.id}
                onClick={() => void handleSelect(active)}
                className="min-h-[56px] px-8 bg-afs-crimson hover:bg-afs-crimson-hover disabled:opacity-60 text-white font-label text-lg font-semibold rounded focus:outline-none focus:ring-2 focus:ring-afs-ink-900"
              >
                {busyId === active.id ? 'Opening…' : 'Select'}
              </button>
              <button
                type="button"
                data-testid="profile-pin"
                disabled={busyId === active.id}
                onClick={() => void togglePin(active)}
                className="min-h-[56px] px-5 bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 font-label text-base rounded hover:bg-afs-bg-light-raised focus:outline-none focus:ring-2 focus:ring-afs-crimson"
              >
                {pinnedIds.includes(active.id) ? 'Unpin' : 'Pin'}
              </button>
            </div>

            <p className="font-body text-sm text-afs-ink-700 mt-3">
              {selectNote ?? 'Select opens this profile in FlashDraft as a new draft. The original is never changed.'}
            </p>
          </section>
        ) : (
          <div className="bg-afs-bg-card border border-afs-border-light rounded p-5 min-h-[200px] flex items-center">
            <p className="font-body text-base text-afs-ink-700">
              {totalShown > 0
                ? 'Hover, tap, or arrow onto a thumbnail to see it full size.'
                : showingShortcuts
                  ? 'Search for a customer, a person, a profile name, or a type.'
                  : 'Nothing to preview yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
