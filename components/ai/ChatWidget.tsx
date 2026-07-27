'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import EscalationCard from './EscalationCard';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  escalated?: boolean;
  escalationReason?: string | null;
}

const ESCALATE_PATTERN = /^\s*\[ESCALATE:\s*(\{[\s\S]*?\})\]\s*/;
const MAX_HISTORY = 20;

// ChatWidget is mounted once, at the top of components/layout/AppChrome.tsx
// (rendered from the root layout, outside the per-page {children} slot), so
// client-side navigation re-renders it in place rather than unmounting it —
// `expanded` already survives route changes without this. What it can't
// survive is a genuine full page reload (a plain <a href> instead of next/
// link, a mobile browser reloading a backgrounded tab, a PWA/webview
// returning from a share sheet) — any of those remount the whole React tree
// from scratch. sessionStorage carries `expanded` across exactly that case,
// wrapped in try/catch since some mobile browsers (e.g. Safari private
// browsing) throw on storage access instead of just no-op'ing.
const EXPANDED_STORAGE_KEY = 'afs-chat-expanded';

function readStoredExpanded(): boolean {
  try {
    return window.sessionStorage.getItem(EXPANDED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function stripEscalation(content: string): { text: string; escalated: boolean; reason: string | null } {
  const match = content.match(ESCALATE_PATTERN);
  if (!match) return { text: content, escalated: false, reason: null };

  let reason: string | null = null;
  try {
    const parsed = JSON.parse(match[1]) as { reason?: string };
    reason = parsed.reason ?? null;
  } catch {
    reason = null;
  }

  return { text: content.slice(match[0].length), escalated: true, reason };
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center px-4 py-3">
      <span className="w-1.5 h-1.5 rounded-full bg-afs-chrome-base animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-afs-chrome-base animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-afs-chrome-base animate-bounce" />
    </div>
  );
}

export default function ChatWidget() {
  const [expanded, setExpanded] = useState(readStoredExpanded);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string>('');
  const expandedRef = useRef(expanded);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!conversationIdRef.current) {
    conversationIdRef.current = crypto.randomUUID();
  }

  useEffect(() => {
    expandedRef.current = expanded;
    if (expanded) setUnreadCount(0);
    try {
      window.sessionStorage.setItem(EXPANDED_STORAGE_KEY, expanded ? '1' : '0');
    } catch {
      // Storage unavailable (private browsing, etc.) — expanded still works
      // for this page view, it just won't survive a full page reload.
    }
  }, [expanded]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isStreaming]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const assistantId = crypto.randomUUID();

    const historyForRequest = [...messages, userMessage]
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForRequest, conversationId: conversationIdRef.current }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const partial = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m))
        );
      }

      const { text, escalated, reason } = stripEscalation(accumulated);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: text, escalated, escalationReason: reason } : m
        )
      );

      if (!expandedRef.current) {
        setUnreadCount((c) => c + 1);
      }
    } catch {
      setError('AFS Support is unavailable right now. Please try again, or contact us directly.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Open AFS Support chat"
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-afs-crimson hover:bg-afs-crimson-hover shadow-crimson flex items-center justify-center transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-white text-afs-crimson border border-afs-crimson text-xs font-label font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] max-w-[calc(100vw-2rem)] bg-afs-bg-raised border border-afs-border rounded shadow-raised metal-edge flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-afs-border bg-afs-bg-raised">
        <p className="font-heading text-lg font-semibold text-afs-chrome-high">AFS Support</p>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close chat"
          className="text-afs-chrome-mid hover:text-afs-chrome-high transition-colors text-xl leading-none px-1"
        >
          &times;
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="font-body text-sm text-afs-chrome-mid">
            Ask about products, ordering, or your account. For pricing, submit a quote request and our estimators will follow up.
          </p>
        )}

        {messages.map((message, idx) => {
          const isLastAssistant =
            message.role === 'assistant' && idx === messages.length - 1 && isStreaming;

          if (message.role === 'assistant' && message.content === '' && isLastAssistant) {
            return (
              <div key={message.id} className="bg-afs-bg-surface border border-afs-border rounded mr-8">
                <TypingIndicator />
              </div>
            );
          }

          return (
            <div key={message.id} className="flex flex-col gap-2">
              <div
                className={`rounded px-4 py-2.5 font-body text-sm whitespace-pre-line ${
                  message.role === 'user'
                    ? 'bg-afs-bg-overlay text-afs-chrome-high ml-8'
                    : 'bg-afs-bg-surface border border-afs-border text-afs-chrome-high mr-8'
                }`}
              >
                {message.content}
              </div>
              {message.escalated && (
                <EscalationCard reason={message.escalationReason} />
              )}
            </div>
          );
        })}

        {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
      </div>

      <div className="border-t border-afs-border p-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors max-h-[120px]"
        />
        <button
          type="button"
          onClick={send}
          disabled={isStreaming || !input.trim()}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Send
        </button>
      </div>
    </div>
  );
}
