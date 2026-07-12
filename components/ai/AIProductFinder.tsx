'use client';

import Link from 'next/link';
import { useState } from 'react';
import StockBadge from '@/components/product/StockBadge';
import type { StockType } from '@/lib/data/catalog';

interface FinderMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FinderProduct {
  slug: string;
  categorySlug: string;
  name: string;
  materials: string[];
  stockType: StockType;
  reason: string;
}

interface FinderResponse {
  message: string;
  products: FinderProduct[];
  needsMoreInfo: boolean;
  clarifyingQuestion: string | null;
}

interface FinderErrorResponse {
  error: string;
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none resize-none';

export default function AIProductFinder() {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<FinderMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinderResponse | null>(null);

  const hasStarted = history.length > 0;

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    const priorHistory = history;

    try {
      const res = await fetch('/api/products/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, conversationHistory: priorHistory }),
      });
      const data = (await res.json()) as FinderResponse | FinderErrorResponse;
      if (!res.ok || 'error' in data) {
        setError('error' in data ? data.error : 'The product finder is unavailable right now.');
        return;
      }
      setHistory([
        ...priorHistory,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: data.message },
      ]);
      setResult(data);
      setQuery('');
    } catch {
      setError('The product finder is unavailable right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setHistory([]);
    setResult(null);
    setQuery('');
    setError(null);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {!hasStarted && (
        <div className="text-center mb-8">
          <h2 className="font-heading text-2xl text-afs-chrome-high mb-2">
            Describe what you&apos;re looking for — in your own words
          </h2>
          <p className="font-body text-sm text-afs-chrome-mid">
            No need to know the technical name. Tell us what it does and where it goes.
          </p>
        </div>
      )}

      {hasStarted && (
        <div className="space-y-4 mb-6">
          {history.map((m, i) => (
            <div
              key={i}
              className={`font-body text-sm rounded p-4 border max-w-[85%] ${
                m.role === 'user'
                  ? 'bg-afs-bg-surface border-afs-border text-afs-chrome-high ml-auto'
                  : 'bg-afs-bg-raised border-afs-chrome-dim text-afs-chrome-mid'
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-start mb-8">
        <textarea
          rows={hasStarted ? 2 : 3}
          className={`${inputClass} flex-1 min-w-[240px]`}
          placeholder="e.g., 'the metal cap that goes on top of a parapet wall'"
          value={query}
          disabled={loading}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !query.trim()}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? 'Searching…' : hasStarted ? 'Send' : 'Find Products'}
        </button>
      </div>

      {error && <p className="font-body text-sm text-afs-crimson mb-6">{error}</p>}

      {result && result.products.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {result.products.map((p) => (
              <div
                key={p.slug}
                className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden flex flex-col p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim">
                    {p.categorySlug.replace(/-/g, ' ')}
                  </span>
                  <StockBadge stockType={p.stockType} />
                </div>
                <h3 className="font-heading text-xl text-afs-chrome-high mb-1">{p.name}</h3>
                <p className="font-body text-sm text-afs-chrome-mid mb-3">{p.materials.join(', ')}</p>
                <p className="font-body text-sm text-afs-chrome-base italic mb-5">
                  &quot;{p.reason}&quot;
                </p>
                <Link
                  href={`/quote?product=${p.slug}`}
                  className="mt-auto bg-afs-crimson hover:bg-afs-crimson-hover text-white text-center font-label font-semibold text-sm px-4 py-2.5 rounded transition-colors"
                >
                  Request a Quote
                </Link>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={startOver}
            className="font-body text-sm text-afs-chrome-mid hover:text-afs-crimson transition-colors"
          >
            Not what you&apos;re looking for? Start over
          </button>
        </div>
      )}

      {result && result.needsMoreInfo && result.products.length === 0 && (
        <p className="font-body text-sm text-afs-chrome-mid">
          Answer above to help us find the right product.
        </p>
      )}
    </div>
  );
}
