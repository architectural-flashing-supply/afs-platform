export type BadgeVariant = 'success' | 'warning' | 'error' | 'chrome' | 'info';

const DOT_CLASS: Record<BadgeVariant, string> = {
  success: 'bg-afs-success',
  warning: 'bg-afs-warning',
  error: 'bg-afs-crimson',
  chrome: 'bg-afs-chrome-base',
  info: 'bg-afs-info',
};

const TEXT_CLASS: Record<BadgeVariant, string> = {
  success: 'text-afs-success-on-dark',
  warning: 'text-afs-warning-on-dark',
  error: 'text-afs-danger-on-dark',
  chrome: 'text-afs-chrome-mid',
  info: 'text-afs-info-on-dark',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export default function Badge({ variant, children, pulse = false, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 border border-afs-chrome-dim rounded font-label whitespace-nowrap ${
        size === 'md' ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-1'
      } ${TEXT_CLASS[variant]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[variant]} ${pulse ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  );
}
