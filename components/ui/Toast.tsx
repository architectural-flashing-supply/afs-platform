'use client';

import { useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string | null;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

const BORDER_CLASS: Record<ToastVariant, string> = {
  success: 'border-afs-accent-green',
  error: 'border-afs-crimson',
  info: 'border-afs-info',
};

export default function Toast({ message, variant = 'success', duration = 3000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[70] bg-afs-bg-raised border rounded px-4 py-3 shadow-raised ${BORDER_CLASS[variant]}`}
    >
      <p className="font-body text-sm text-afs-chrome-high">{message}</p>
    </div>
  );
}
