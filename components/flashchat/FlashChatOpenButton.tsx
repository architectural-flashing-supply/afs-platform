'use client';

import type { ReactNode } from 'react';

export interface FlashChatOpenEventDetail {
  question?: string;
}

interface FlashChatOpenButtonProps {
  question?: string;
  className: string;
  children: ReactNode;
}

// Dispatched on `window` and picked up by components/ai/ChatWidget.tsx's
// 'open-flashchat' listener — lets any page open the (globally-mounted)
// chat widget, optionally pre-filling a question, without either side
// importing the other.
export default function FlashChatOpenButton({ question, className, children }: FlashChatOpenButtonProps) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent<FlashChatOpenEventDetail>('open-flashchat', {
        detail: question ? { question } : undefined,
      })
    );
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
