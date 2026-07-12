'use client';

import { useState } from 'react';
import type { SpecSection } from '@/lib/anthropic/spec';

interface SpecPreviewProps {
  spec: SpecSection;
  isSoleSource: boolean;
  onStartOver: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type PartKey = 'part1' | 'part2' | 'part3';

const PART_LABEL: Record<PartKey, string> = {
  part1: 'Part 1',
  part2: 'Part 2',
  part3: 'Part 3',
};

export default function SpecPreview({ spec, isSoleSource, onStartOver }: SpecPreviewProps) {
  const [editableSpec, setEditableSpec] = useState<SpecSection>(spec);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateArticle = (partKey: PartKey, idx: number, content: string) => {
    setEditableSpec((prev) => {
      const part = prev[partKey];
      const articles = part.articles.map((a, i) => (i === idx ? { ...a, content } : a));
      return { ...prev, [partKey]: { ...part, articles } };
    });
    setSavedId(null);
    setSaveState('idle');
  };

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/spec/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editableSpec, isSoleSource }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? 'Could not save. Please try again.');
        setSaveState('error');
        return;
      }
      setSavedId(data.id as string);
      setSaveState('saved');
    } catch {
      setSaveError('Could not save. Please try again.');
      setSaveState('error');
    }
  };

  const renderPart = (partKey: PartKey) => {
    const part = editableSpec[partKey];
    return (
      <section key={partKey} className="mb-8">
        <h3 className="font-heading text-xl text-afs-ink-900 mb-4 uppercase tracking-wide">
          {PART_LABEL[partKey]} — {part.title}
        </h3>
        <div className="space-y-5">
          {part.articles.map((article, idx) => (
            <div key={`${partKey}-${article.number}`} className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4">
              <p className="font-data text-sm text-afs-copper mb-2">
                <span className="font-semibold">{article.number}</span>{' '}
                <span className="uppercase tracking-wide">{article.title}</span>
              </p>
              <textarea
                value={article.content}
                onChange={(e) => updateArticle(partKey, idx, e.target.value)}
                rows={Math.min(12, Math.max(3, Math.ceil(article.content.length / 80)))}
                className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-ink-900 focus:outline-none focus:border-afs-copper transition-colors resize-y"
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="metal-edge metal-edge-copper bg-afs-bg-raised border border-afs-border rounded p-6 md:p-10">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <p className="font-label text-afs-copper text-xs tracking-widest uppercase mb-2">Generated Specification</p>
          <h2 className="font-heading text-2xl text-afs-ink-900">
            {editableSpec.csiSection} — {editableSpec.csiTitle}
          </h2>
          <p className="font-body text-xs text-afs-ink-700 mt-2">
            DRAFT — verify with AFS before use in contract documents.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save to Account'}
          </button>
          <a
            href={savedId ? `/api/spec/${savedId}/docx` : undefined}
            onClick={(e) => {
              if (!savedId) e.preventDefault();
            }}
            className={`font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors border ${
              savedId
                ? 'border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface'
                : 'border-afs-chrome-dim text-afs-ink-700 cursor-not-allowed'
            }`}
          >
            Download DOCX
          </a>
          <button
            type="button"
            onClick={onStartOver}
            className="font-body text-xs text-afs-ink-700 hover:text-afs-copper transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>

      {saveError && <p className="font-body text-sm text-afs-crimson mb-6">{saveError}</p>}
      {!savedId && saveState !== 'saving' && (
        <p className="font-body text-xs text-afs-ink-700 mb-6">Save to your account to enable DOCX download.</p>
      )}

      {renderPart('part1')}
      {renderPart('part2')}
      {renderPart('part3')}
    </div>
  );
}
