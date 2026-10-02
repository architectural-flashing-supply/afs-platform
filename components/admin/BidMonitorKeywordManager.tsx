'use client';

import { useState } from 'react';
import type { BidKeywordRow } from '@/lib/data/bid-monitor';

const CATEGORIES = ['profile', 'material', 'division', 'trade'] as const;

async function toggleKeyword(id: string, isActive: boolean): Promise<{ error?: string }> {
  const res = await fetch(`/api/bid-monitor/keywords/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  return (await res.json().catch(() => ({}))) as { error?: string };
}

export default function BidMonitorKeywordManager({ keywords: initialKeywords }: { keywords: BidKeywordRow[] }) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState<(typeof CATEGORIES)[number] | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bid-monitor/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim(), category: newCategory || undefined }),
      });
      const data = (await res.json()) as { keyword?: BidKeywordRow; error?: string };
      if (!res.ok || !data.keyword) {
        setError(data.error ?? 'Could not add keyword.');
        setBusy(false);
        return;
      }
      setKeywords((prev) => [...prev, data.keyword as BidKeywordRow].sort((a, b) => a.keyword.localeCompare(b.keyword)));
      setNewKeyword('');
      setNewCategory('');
      setShowAddForm(false);
      setBusy(false);
    } catch {
      setError('Network error.');
      setBusy(false);
    }
  };

  const handleToggle = async (keyword: BidKeywordRow) => {
    setTogglingId(keyword.id);
    setError(null);
    const nextActive = !keyword.isActive;
    const result = await toggleKeyword(keyword.id, nextActive);
    if (result.error) {
      setError(result.error);
      setTogglingId(null);
      return;
    }
    setKeywords((prev) => prev.map((k) => (k.id === keyword.id ? { ...k, isActive: nextActive } : k)));
    setTogglingId(null);
  };

  return (
    <div className="bg-afs-bg-card border border-afs-border-light rounded p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-body text-sm text-afs-ink-700">
          {keywords.length} keyword{keywords.length === 1 ? '' : 's'} — matched against every fetched bid title/description
          to flag Division 7 relevance.
        </p>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-4 py-2 rounded transition-colors"
        >
          + Add Keyword
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 mb-4 bg-afs-bg-light-raised border border-afs-border-light rounded p-4">
          <div className="flex-1 min-w-[180px]">
            <label className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1">Keyword</label>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="e.g. reglet"
              className="f"
            />
          </div>
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as (typeof CATEGORIES)[number] | '')}
              className="f"
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy || !newKeyword.trim()}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            className="font-label text-sm text-afs-ink-700 hover:text-afs-v7-ink px-2 py-2"
          >
            Cancel
          </button>
        </form>
      )}

      {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <button
            key={kw.id}
            type="button"
            disabled={togglingId === kw.id}
            onClick={() => handleToggle(kw)}
            title={kw.isActive ? 'Click to deactivate' : 'Click to activate'}
            className={`flex items-center gap-2 border rounded-full pl-3 pr-2 py-1.5 font-label text-xs transition-colors disabled:opacity-50 ${
              kw.isActive
                ? 'border-afs-success text-afs-v7-ink bg-[var(--afs-success-ghost)]'
                : 'border-afs-chrome-dim text-afs-ink-700 bg-transparent line-through'
            }`}
          >
            <span>{kw.keyword}</span>
            <span className="font-data text-[10px] text-afs-ink-700">{kw.matchCount}</span>
            <span
              className={`w-2 h-2 rounded-full ${kw.isActive ? 'bg-afs-success' : 'bg-afs-chrome-dim'}`}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}
