'use client';

import { useState } from 'react';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIInstallationAdvisorProps {
  profileSlug: string;
  profileName: string;
}

const MAX_TURNS = 10;

export default function AIInstallationAdvisor({ profileSlug, profileName }: AIInstallationAdvisorProps) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnsUsed = history.filter((m) => m.role === 'user').length;
  const limitReached = turnsUsed >= MAX_TURNS;

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading || limitReached) return;

    setError(null);
    setLoading(true);
    const nextHistory: ConversationMessage[] = [...history, { role: 'user', content: trimmed }];
    setHistory(nextHistory);
    setQuestion('');

    try {
      const res = await fetch('/api/architects/installation-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileSlug,
          profileName,
          question: trimmed,
          conversationHistory: history,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'The advisor is unavailable right now.');
        setHistory(history);
        return;
      }
      setHistory([...nextHistory, { role: 'assistant', content: data.answer as string }]);
    } catch {
      setError('The advisor is unavailable right now. Please try again.');
      setHistory(history);
    } finally {
      setLoading(false);
    }
  };

  const startNewQuestion = () => {
    setHistory([]);
    setQuestion('');
    setError(null);
  };

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <p className="font-label text-afs-copper text-sm tracking-widest uppercase mb-3">
        Have a Question About This Installation?
      </p>
      <p className="font-body text-afs-ink-700 text-base mb-6">
        Ask our AI advisor — trained on AFS fabrication practices and SMACNA standards.
      </p>

      {history.length > 0 && (
        <div className="space-y-4 mb-6">
          {history.map((message, idx) => (
            <div
              key={idx}
              className={`rounded p-4 border ${
                message.role === 'user'
                  ? 'bg-afs-bg-surface border-afs-border ml-8'
                  : 'bg-afs-bg-raised border-afs-copper mr-8'
              }`}
            >
              <p className="font-label text-xs uppercase tracking-wide text-afs-crimson mb-1">
                {message.role === 'user' ? 'You' : 'AFS Installation Advisor'}
              </p>
              <p className="font-body text-sm text-afs-ink-900 whitespace-pre-line">{message.content}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="font-body text-sm text-afs-crimson mb-4">{error}</p>}

      {limitReached ? (
        <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 text-center">
          <p className="font-body text-sm text-afs-ink-700 mb-3">
            You&apos;ve reached the limit for this conversation.
          </p>
          <button
            type="button"
            onClick={startNewQuestion}
            className="font-label text-sm text-afs-copper hover:text-afs-copper-hover transition-colors"
          >
            Start New Question
          </button>
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask();
            }}
            placeholder="Your installation question..."
            className="flex-1 min-w-[240px] bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-ink-900 placeholder:text-afs-ink-700 focus:outline-none focus:border-afs-copper transition-colors"
          />
          <button
            type="button"
            onClick={ask}
            disabled={loading || !question.trim()}
            className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>
      )}

      {history.length > 0 && !limitReached && (
        <button
          type="button"
          onClick={startNewQuestion}
          className="font-body text-xs text-afs-ink-700 hover:text-afs-copper transition-colors mt-4"
        >
          Start New Question
        </button>
      )}
    </section>
  );
}
