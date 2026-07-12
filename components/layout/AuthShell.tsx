import Image from 'next/image';
import Link from 'next/link';

export const authInputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 text-afs-chrome-high font-body text-sm placeholder:text-afs-chrome-dim focus:border-afs-crimson outline-none transition-colors';

export const authLabelClass =
  'block font-label text-xs uppercase tracking-widest text-afs-chrome-mid mb-2';

export const authButtonClass =
  'w-full bg-afs-crimson hover:bg-afs-crimson-hover disabled:bg-afs-crimson-dim disabled:cursor-not-allowed text-white font-label font-semibold text-sm rounded px-6 py-3 transition-colors';

export const authErrorClass =
  'bg-[var(--afs-crimson-ghost)] border border-afs-crimson rounded px-4 py-3 mb-6';

export const authSuccessClass =
  'bg-[var(--afs-success-ghost)] border border-afs-success rounded px-4 py-3 mb-6';

interface AuthShellProps {
  children: React.ReactNode;
}

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-afs-bg-base">
      <div className="w-full max-w-[480px] mx-auto mt-24 mb-16 px-4">
        <div className="metal-edge bg-afs-bg-raised border border-afs-border rounded shadow-raised px-8 py-10">
          <div className="flex justify-center mb-8">
            <Link href="/" className="inline-block bg-afs-bg-dim rounded-sm px-4 py-2">
              <Image
                src="/afs-logo.png"
                alt="AFS Architectural Flashing Supply"
                width={160}
                height={114}
                priority
                className="h-16 w-auto object-contain"
              />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
