'use client';

import { ReactNode, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = 'max-w-md',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-6"
      onClick={onClose}
    >
      <div
        className={`bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 w-full ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="font-heading text-xl text-afs-chrome-high mb-4">{title}</h3>}
        {children}
        {footer && <div className="flex gap-3 justify-end mt-6">{footer}</div>}
      </div>
    </div>
  );
}
