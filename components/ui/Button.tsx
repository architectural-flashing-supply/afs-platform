import { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-afs-crimson hover:bg-afs-crimson-hover text-white',
  secondary: 'border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface',
  danger: 'border-2 border-afs-crimson bg-transparent text-afs-crimson hover:bg-afs-crimson hover:text-white',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`font-label font-semibold rounded transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
