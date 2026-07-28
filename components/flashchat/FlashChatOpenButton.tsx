'use client';

import type { ReactNode } from 'react';

interface FlashChatOpenButtonProps {
  question?: string;
  className: string;
  children: ReactNode;
}

// Dispatched on `window` and picked up by components/ai/ChatWidget.tsx's
// 'open-flashchat' / 'flashchat-prefill' listeners — lets any page open the
// (globally-mounted) chat widget, optionally pre-filling a question, without
// either side importing the other. The prefill fires ~300ms after open so
// the panel is already expanding before the input value changes.
export default function FlashChatOpenButton({ question, className, children }: FlashChatOpenButtonProps) {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('open-flashchat'));
    if (question) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('flashchat-prefill', { detail: question }));
      }, 300);
    }
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
