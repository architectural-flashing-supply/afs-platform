'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isUnsure } from '@/lib/ai/takeoff-confidence';

export interface SvAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  takeoffStatus: string | null;
  takeoffError: string | null;
}
export interface SvItem {
  id: string;
  profileType: string;
  material: string | null;
  gauge: string | null;
  finish: string | null;
  width: number | null;
  height: number | null;
  legA: number | null;
  legB: number | null;
  lengthFt: number | null;
  quantity: number | null;
  unit: string | null;
  confidence: string | null;
  aiNote: string | null;
  flags: string[];
  edited?: boolean;
  source_ref: {
    emailAttachmentId?: string;
    page?: number | null;
    region?: { x: number; y: number; w: number; h: number } | null;
    bodySpan?: { start: number; end: number } | null;
  } | null;
}
export interface SvEmail {
  fromName: string | null;
  fromAddress: string | null;
  subject: string;
  sentAt: string | null;
  textBody: string | null;
  safeHtml: string | null;
  /** Same sanitized HTML but with https images allowed; only shown after the viewer opts in. */
  safeHtmlImages: string | null;
}
export interface SvCorrection { id: string; line_item_id: string; field: string; old_value: unknown; new_value: unknown; created_at: string; reason: string | null }

type Pane = { kind: 'email' } | { kind: 'attachment'; id: string };
const FIELDS: { key: keyof SvItem; label: string; numeric: boolean }[] = [
  { key: 'profileType', label: 'Profile', numeric: false },
  { key: 'material', label: 'Material', numeric: false },
  { key: 'gauge', label: 'Gauge', numeric: false },
  { key: 'width', label: 'W"', numeric: true },
  { key: 'height', label: 'H"', numeric: true },
  { key: 'legA', label: 'Leg A"', numeric: true },
  { key: 'legB', label: 'Leg B"', numeric: true },
  { key: 'lengthFt', label: 'Length ft', numeric: true },
  { key: 'quantity', label: 'Qty', numeric: true },
];

export default function SourceViewer(props: {
  quoteRequestId: string;
  email: SvEmail;
  attachments: SvAttachment[];
  initialItems: SvItem[];
  corrections: SvCorrection[];
}) {
  const { email, attachments } = props;
  const [items, setItems] = useState<SvItem[]>(props.initialItems);
  const [corrections, setCorrections] = useState<SvCorrection[]>(props.corrections);
  const [pane, setPane] = useState<Pane>({ kind: 'email' });
  const [selected, setSelected] = useState<string | null>(null);
  const [filterAtt, setFilterAtt] = useState<string | null>(null);
  const [view, setView] = useState<'html' | 'text'>(email.safeHtml ? 'html' : 'text');
  const [loadImages, setLoadImages] = useState(false);
  const [mobileTab, setMobileTab] = useState<'email' | 'takeoff'>('takeoff');
  const [split, setSplit] = useState(50);
  const [wide, setWide] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const dragging = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement | null>(null);

  const selectedItem = items.find((i) => i.id === selected) ?? null;

  const ensureUrl = useCallback(
    async (attId: string) => {
      if (urls[attId]) return;
      try {
        const r = await fetch(`/api/admin/email-intake/attachment?id=${attId}`);
        const j = await r.json();
        if (j.url) setUrls((u) => ({ ...u, [attId]: j.url }));
      } catch {
        setError('Could not load the attachment.');
      }
    },
    [urls],
  );

  // Click an item on the right -> the left pane jumps to its source.
  const selectItem = useCallback(
    (item: SvItem) => {
      setSelected(item.id);
      setMobileTab('email');
      const ref = item.source_ref;
      if (ref?.emailAttachmentId) {
        setPane({ kind: 'attachment', id: ref.emailAttachmentId });
        setPage(ref.page ?? null);
        void ensureUrl(ref.emailAttachmentId);
      } else if (ref?.bodySpan) {
        setPane({ kind: 'email' });
        setView('text');
      }
    },
    [ensureUrl],
  );

  // Click a source on the left -> the right pane filters to items read from it.
  const openAttachment = (id: string) => {
    setPane({ kind: 'attachment', id });
    setFilterAtt(id);
    setSelected(null);
    setPage(null);
    void ensureUrl(id);
  };
  const openEmail = () => {
    setPane({ kind: 'email' });
    setFilterAtt(null);
  };

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selected, view, pane]);

  const visible = useMemo(() => (filterAtt ? items.filter((i) => i.source_ref?.emailAttachmentId === filterAtt) : items), [items, filterAtt]);
  const unknownCount = items.filter((i) => !i.source_ref).length;

  async function correct(item: SvItem, field: keyof SvItem, raw: string, numeric: boolean) {
    const current = item[field];
    const next = raw.trim() === '' ? null : numeric ? Number(raw) : raw.trim();
    if (next === current || (next === null && current === null)) return;
    if (numeric && next !== null && !Number.isFinite(next as number)) return setError(`${String(field)} must be a number`);
    setError(null);
    const r = await fetch(`/api/admin/quote-requests/${props.quoteRequestId}/corrections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineItemId: item.id, field, value: next }),
    });
    const j = await r.json();
    if (!r.ok) return setError(j.error ?? 'Could not save the change.');
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, ...j.item } : i)));
    setCorrections((c) => [{ id: crypto.randomUUID(), line_item_id: item.id, field: String(field), old_value: current, new_value: next, created_at: new Date().toISOString(), reason: null }, ...c]);
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // resizable split
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !container.current) return;
      const r = container.current.getBoundingClientRect();
      setSplit(Math.min(75, Math.max(25, ((e.clientX - r.left) / r.width) * 100)));
    };
    const up = () => (dragging.current = false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const activeAtt = pane.kind === 'attachment' ? attachments.find((a) => a.id === pane.id) ?? null : null;
  const span = selectedItem?.source_ref?.bodySpan ?? null;
  const region = selectedItem?.source_ref?.emailAttachmentId === activeAtt?.id ? selectedItem?.source_ref?.region ?? null : null;

  const leftPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-neutral-300 bg-neutral-100 p-2" role="tablist" aria-label="Email and attachments">
        <button role="tab" aria-selected={pane.kind === 'email'} onClick={openEmail} className={`rounded px-3 py-1.5 text-sm ${pane.kind === 'email' ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-800 ring-1 ring-neutral-300'}`}>
          Email
        </button>
        {attachments.map((a) => (
          <button key={a.id} role="tab" aria-selected={pane.kind === 'attachment' && pane.id === a.id} onClick={() => openAttachment(a.id)} className={`max-w-[14rem] truncate rounded px-3 py-1.5 text-sm ${pane.kind === 'attachment' && pane.id === a.id ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-800 ring-1 ring-neutral-300'}`} title={a.filename}>
            {a.filename}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-white p-4" data-testid="source-left">
        {pane.kind === 'email' ? (
          <div>
            <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-neutral-500">From</dt>
              <dd>{email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress ?? 'Unknown'}</dd>
              <dt className="text-neutral-500">Date</dt>
              <dd>{email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Unknown'}</dd>
              <dt className="text-neutral-500">Subject</dt>
              <dd className="font-medium">{email.subject || '(no subject)'}</dd>
            </dl>
            <div className="mb-2 flex items-center gap-3 text-xs">
              {email.safeHtml && (
                <>
                  <button onClick={() => setView('html')} className={view === 'html' ? 'font-semibold underline' : 'text-neutral-600'}>As received</button>
                  <button onClick={() => setView('text')} className={view === 'text' ? 'font-semibold underline' : 'text-neutral-600'}>Plain text (shows highlights)</button>
                  {view === 'html' && (
                    <label className="ml-auto flex items-center gap-1 text-neutral-600">
                      <input type="checkbox" checked={loadImages} onChange={(e) => setLoadImages(e.target.checked)} /> Load remote images
                    </label>
                  )}
                </>
              )}
            </div>
            {view === 'html' && email.safeHtml ? (
              <iframe
                title="Original email"
                sandbox=""
                srcDoc={`<base target="_blank"><style>body{font:14px system-ui,sans-serif;color:#111;margin:0;word-wrap:break-word}img{max-width:100%}</style>${loadImages ? email.safeHtmlImages ?? email.safeHtml : email.safeHtml}`}
                className="h-[60vh] w-full rounded border border-neutral-200"
              />
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed" data-testid="email-text">
                {span && email.textBody ? (
                  <>
                    {email.textBody.slice(0, span.start)}
                    <mark ref={(el) => { markRef.current = el; }} className="rounded bg-amber-200 px-0.5" data-testid="source-highlight">
                      {email.textBody.slice(span.start, span.end)}
                    </mark>
                    {email.textBody.slice(span.end)}
                  </>
                ) : (
                  email.textBody ?? '(This email has no plain-text body.)'
                )}
              </pre>
            )}
          </div>
        ) : activeAtt ? (
          <div>
            <p className="mb-2 text-sm text-neutral-600">
              {activeAtt.filename} · {(activeAtt.sizeBytes / 1024).toFixed(0)} KB
              {page ? ` · jumped to page ${page}` : ''}
              {activeAtt.takeoffStatus === 'skipped' || activeAtt.takeoffStatus === 'failed' ? ` · NOT READ BY AI${activeAtt.takeoffError ? `: ${activeAtt.takeoffError}` : ''}` : ''}
            </p>
            {!urls[activeAtt.id] ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : /^image\//.test(activeAtt.contentType) ? (
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[activeAtt.id]} alt={activeAtt.filename} className="max-w-full" />
                {region && (
                  <div data-testid="source-region" className="pointer-events-none absolute border-2 border-amber-500 bg-amber-300/30" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }} />
                )}
              </div>
            ) : /pdf/.test(activeAtt.contentType) ? (
              <>
                <iframe key={`${activeAtt.id}-${page ?? 0}`} title={activeAtt.filename} src={`${urls[activeAtt.id]}#page=${page ?? 1}`} className="h-[70vh] w-full rounded border border-neutral-200" />
                {region && <p className="mt-1 text-xs text-neutral-500" data-testid="source-region-note">AI&apos;s approximate location on the page: {Math.round(region.x * 100)}% across, {Math.round(region.y * 100)}% down.</p>}
              </>
            ) : (
              <a href={urls[activeAtt.id]} className="text-blue-700 underline" target="_blank" rel="noreferrer">Download {activeAtt.filename}</a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  const rightPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-300 bg-neutral-100 p-2 text-sm">
        <span className="font-medium">AI takeoff · {visible.length} item{visible.length === 1 ? '' : 's'}{filterAtt ? ' from this file' : ''}</span>
        {filterAtt && <button className="underline" onClick={() => setFilterAtt(null)}>Show all</button>}
      </div>
      {unknownCount > 0 && <p className="bg-amber-50 px-3 py-1.5 text-xs text-amber-900">{unknownCount} item{unknownCount === 1 ? '' : 's'} with source unknown — check these first.</p>}
      {error && <p className="bg-red-50 px-3 py-1.5 text-xs text-red-800" role="alert">{error}</p>}
      <div className="min-h-0 flex-1 overflow-auto p-2" data-testid="source-right">
        {visible.length === 0 && <p className="p-3 text-sm text-neutral-600">No items were read from here. If this email contains an order, enter the items by hand on the quote request.</p>}
        <ul className="space-y-2">
          {visible.map((item) => {
            const unsure = isUnsure(item.confidence);
            return (
              <li key={item.id} data-testid="takeoff-item" data-item-id={item.id} onClick={() => selectItem(item)} className={`cursor-pointer rounded border p-2 text-sm ${selected === item.id ? 'border-amber-500 ring-2 ring-amber-300' : 'border-neutral-300'} ${unsure ? 'bg-amber-50' : 'bg-white'}`}>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3">
                  {FIELDS.map((f) => {
                    const v = item[f.key];
                    const missing = v === null || v === undefined || v === '';
                    return (
                      <label key={String(f.key)} className="flex flex-col text-[11px] text-neutral-500" onClick={(e) => e.stopPropagation()}>
                        {f.label}
                        <input
                          defaultValue={missing ? '' : String(v)}
                          key={`${item.id}-${String(f.key)}-${String(v)}`}
                          inputMode={f.numeric ? 'decimal' : 'text'}
                          placeholder={missing ? 'not read' : ''}
                          onBlur={(e) => correct(item, f.key, e.target.value, f.numeric)}
                          className={`rounded border px-1.5 py-1 text-sm text-neutral-900 ${missing ? 'border-red-400 bg-red-50' : 'border-neutral-300'}`}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`rounded px-1.5 py-0.5 ${unsure ? 'bg-amber-200 text-amber-900' : 'bg-green-100 text-green-900'}`}>{item.confidence ?? 'unknown'} confidence</span>
                  {item.edited && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900">corrected</span>}
                  {!item.source_ref && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-900">source unknown</span>}
                  {item.flags.filter((f) => f !== 'Source unknown').map((f) => (
                    <span key={f} className="rounded bg-red-50 px-1.5 py-0.5 text-red-800">{f}</span>
                  ))}
                </div>
                {item.aiNote && <p className="mt-1 text-xs text-neutral-600">AI note: {item.aiNote}</p>}
              </li>
            );
          })}
        </ul>
        {corrections.length > 0 && (
          <details className="mt-4 text-xs text-neutral-700">
            <summary className="cursor-pointer font-medium">Correction log ({corrections.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {corrections.map((c) => (
                <li key={c.id}>{new Date(c.created_at).toLocaleString()} · {c.field}: {String(c.old_value ?? 'blank')} → {String(c.new_value ?? 'blank')}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );

  if (wide) {
    // Desktop: resizable split, 50/50 at start.
    return (
      <div ref={container} className="flex h-[78vh] overflow-hidden rounded border border-neutral-300">
        <div style={{ width: `${split}%` }} className="min-w-0">{leftPane}</div>
        <div role="separator" aria-orientation="vertical" aria-label="Resize panes" tabIndex={0} onPointerDown={() => (dragging.current = true)} onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(25, s - 3)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(75, s + 3)); }} className="w-1.5 shrink-0 cursor-col-resize bg-neutral-300 hover:bg-neutral-500" />
        <div style={{ width: `${100 - split}%` }} className="min-w-0">{rightPane}</div>
      </div>
    );
  }
  // Tablet / narrow: two tabs with the same linking.
  return (
    <div>
      <div className="mb-2 flex gap-1" role="tablist">
        {(['email', 'takeoff'] as const).map((t2) => (
          <button key={t2} role="tab" aria-selected={mobileTab === t2} onClick={() => setMobileTab(t2)} className={`flex-1 rounded px-3 py-2 text-sm ${mobileTab === t2 ? 'bg-neutral-900 text-white' : 'bg-white ring-1 ring-neutral-300'}`}>
            {t2 === 'email' ? 'Email' : 'Takeoff'}
          </button>
        ))}
      </div>
      <div className="h-[75vh] overflow-hidden rounded border border-neutral-300">{mobileTab === 'email' ? leftPane : rightPane}</div>
    </div>
  );
}
