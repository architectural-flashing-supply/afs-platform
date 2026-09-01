'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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

const SUGGESTED_QUESTIONS = [
  "What's the minimum slope for a coping cap?",
  'Copper vs aluminum — which for coastal Texas?',
  'What does Section 07 62 00 cover?',
  'How do I prevent oil-canning in flat panels?',
  'What is the SMACNA standard for end laps?',
  'What profile do I need for a parapet wall?',
];

interface RoutingLink {
  label: string;
  href: string;
}

function getRoutingLinks(content: string): RoutingLink[] {
  const links: RoutingLink[] = [];
  if (content.includes('/configure')) {
    links.push({ label: 'Open Configurator →', href: '/configure' });
  }
  if (content.includes('/studio/draft')) {
    links.push({ label: 'Open FlashDraft →', href: '/studio/draft' });
  } else if (content.includes('/studio')) {
    links.push({ label: 'Go to Design Studio →', href: '/studio' });
  }
  return links;
}

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
      <span className="w-1.5 h-1.5 rounded-full bg-afs-chrome-base animate-pulse [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-afs-chrome-base animate-pulse [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-afs-chrome-base animate-pulse" />
    </div>
  );
}

function HardHatQuestionIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      {/* Hard hat - bright crimson */}
      <path fill="#C0001A" d="M12 2C8.5 2 5.7 4.1 4.5 7H4C2.9 7 2 7.9 2 9v1c0 .6.4 1 1 1h18c.6 0 1-.4 1-1V9c0-1.1-.9-2-2-2h-.5C18.3 4.1 15.5 2 12 2zM2 12v1c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-1H2z" />
      {/* Question mark - bright white */}
      <text x="12" y="11.5" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="bold" fontSize="7" fill="#FFFFFF">
        ?
      </text>
    </svg>
  );
}

export default function ChatWidget() {
  // Belt-and-suspenders hydration guard. ChatWidget is already loaded via
  // next/dynamic(..., { ssr: false }) in AppChrome.tsx, so the server never
  // renders any markup for it and there's no first-paint mismatch possible
  // for this component specifically — this additional mounted-gate costs
  // one extra render and protects against a mismatch even if that dynamic()
  // wrapper is ever changed or bypassed.
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(readStoredExpanded);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [sendHover, setSendHover] = useState(false);

  const conversationIdRef = useRef<string>('');
  const expandedRef = useRef(expanded);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);

  if (!conversationIdRef.current) {
    conversationIdRef.current = crypto.randomUUID();
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lets other pages (e.g. app/(public)/flashchat/page.tsx) open this
  // globally-mounted widget without importing it directly — dispatch
  // window.dispatchEvent(new CustomEvent('open-flashchat')) to expand it.
  useEffect(() => {
    const handler = () => setExpanded(true);
    window.addEventListener('open-flashchat', handler);
    return () => window.removeEventListener('open-flashchat', handler);
  }, []);

  // Companion event — dispatched ~300ms after 'open-flashchat' (see
  // FlashChatOpenButton) so the widget is already expanding before the
  // input gets pre-filled (not auto-sent) with a sample question.
  useEffect(() => {
    const handler = (e: Event) => {
      const question = (e as CustomEvent<string>).detail;
      if (typeof question === 'string') setInput(question);
    };
    window.addEventListener('flashchat-prefill', handler);
    return () => window.removeEventListener('flashchat-prefill', handler);
  }, []);

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
    if (isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, []);

  const send = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? input).trim();
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
      setError('FlashChat is unavailable right now. Please try again, or contact us directly.');
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

  const handleChipClick = useCallback(
    (question: string) => {
      send(question);
    },
    [send]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setInput('');
    setError(null);
  }, []);

  if (!mounted) return null;

  if (!expanded) {
    // afs-fl-027: trigger icon reduced from afs-fl-026's 192px (3x) to 115px
    // (1.8x its original 64px), per Reid — 24px inset from the corner is
    // kept as-is.
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          pointerEvents: 'all',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: '115px',
          height: '115px'
        }}
        aria-label="Open FlashChat"
      >
        <img
          src="/chat_bubble_icon.png"
          alt="FlashChat"
          style={{ width: '115px', height: '115px', objectFit: 'contain' }}
        />
      </button>
    );
  }

  return (
    <div
      style={{ position: 'fixed', bottom: '80px', right: '24px', zIndex: 99999, width: '380px', pointerEvents: 'all' }}
      className="h-[520px] max-w-[calc(100vw-2rem)] max-h-[80vh] bg-afs-bg-raised border border-afs-border rounded shadow-raised metal-edge flex flex-col overflow-hidden"
    >
      <div className="flex items-start justify-between px-4 py-3 border-b border-afs-border bg-afs-bg-dim">
        <div>
          <div className="flex items-center gap-1.5">
            <img src="/chat_bubble_icon.png" alt="FlashChat" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <p className="font-heading font-bold text-white text-lg leading-tight">FlashChat</p>
          </div>
          <p className="eyebrow-label text-xs tracking-widest mt-0.5">
            Industry Intelligence
          </p>
          <p className="font-body text-xs text-afs-chrome-mid leading-relaxed mt-1 max-w-[280px]">
            Trained on Division 7 standards, SMACNA specifications, material science,
            and 30+ years of Texas fabrication expertise. Ask anything.
          </p>
          <p className="font-body text-xs text-afs-chrome-dim mt-1 italic">
            For formal quotes and engineering decisions, contact AFS directly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close chat"
          className="text-afs-chrome-mid hover:text-afs-chrome-high transition-colors text-xl leading-none px-1 shrink-0"
        >
          &times;
        </button>
      </div>

      <div
        ref={scrollRef}
        onWheel={(e) => e.stopPropagation()}
        onScroll={handleScroll}
        style={{ overflowY: 'auto', overscrollBehavior: 'contain' }}
        className="flex-1 px-4 py-4 flex flex-col gap-3"
      >
        {messages.length === 0 && (
          <>
            <p className="font-body text-sm text-afs-chrome-mid">
              Ask about products, ordering, or your account. For pricing, submit a quote request and our estimators will follow up.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => handleChipClick(question)}
                  className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high text-xs py-1.5 px-3 rounded-full hover:bg-afs-bg-surface cursor-pointer text-left transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </>
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

          const routingLinks =
            message.role === 'assistant' && message.content ? getRoutingLinks(message.content) : [];

          return (
            <div key={message.id} className="flex flex-col gap-2">
              <div
                style={message.role === 'user' ? { backgroundColor: '#C0001A' } : undefined}
                className={`rounded px-4 py-2.5 font-body text-sm whitespace-pre-line ${
                  message.role === 'user'
                    ? 'text-white ml-8'
                    : 'bg-afs-bg-surface border border-afs-border text-afs-chrome-high mr-8'
                }`}
              >
                {message.content}
              </div>
              {routingLinks.length > 0 && (
                <div className="flex flex-wrap gap-2 mr-8">
                  {routingLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="bg-afs-crimson text-white text-xs font-label px-4 py-2 rounded inline-block hover:bg-afs-crimson-hover transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
              {message.escalated && (
                <EscalationCard reason={message.escalationReason} />
              )}
            </div>
          );
        })}

        {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
      </div>

      {showScrollButton && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="absolute bottom-20 right-4 z-10 w-9 h-9 rounded-full bg-afs-crimson hover:bg-afs-crimson-hover shadow-crimson flex items-center justify-center transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
            <path d="M12 16.5l-6-6 1.41-1.41L12 13.67l4.59-4.58L18 10.5z" />
          </svg>
        </button>
      )}

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
          onClick={handleClear}
          aria-label="Clear conversation"
          title="Clear conversation"
          className="text-afs-chrome-mid hover:text-afs-crimson transition-colors p-2 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M9 3a1 1 0 0 0-1 1v1H4v2h16V5h-4V4a1 1 0 0 0-1-1H9zM6 8l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12H6z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => send()}
          disabled={isStreaming || !input.trim()}
          onMouseEnter={() => setSendHover(true)}
          onMouseLeave={() => setSendHover(false)}
          style={{ backgroundColor: sendHover ? '#E8001F' : '#C0001A', color: 'white' }}
          className="font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Send
        </button>
      </div>
    </div>
  );
}
