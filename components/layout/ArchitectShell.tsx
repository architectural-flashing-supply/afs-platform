interface ArchitectShellProps {
  children: React.ReactNode;
}

interface ArchitectEyebrowProps {
  children: React.ReactNode;
  className?: string;
}

// Copper accent variant of the public page shell. Used on every /architects/** route —
// see SPEC_ARCHITECT_PORTAL.md §3. Crimson is never used inside this shell.
export default function ArchitectShell({ children }: ArchitectShellProps) {
  return <main className="min-h-screen bg-afs-bg-base">{children}</main>;
}

export function ArchitectEyebrow({ children, className = '' }: ArchitectEyebrowProps) {
  return (
    <p className={`font-label text-afs-copper text-sm tracking-widest uppercase mb-3 ${className}`}>
      {children}
    </p>
  );
}
