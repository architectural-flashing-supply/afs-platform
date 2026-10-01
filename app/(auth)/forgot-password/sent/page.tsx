import Link from 'next/link';

export default function ForgotPasswordSentPage() {
  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--afs-crimson-ghost)] flex items-center justify-center mx-auto mb-6">
        <svg className="w-7 h-7 text-afs-danger-on-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h1 className="font-heading text-2xl font-bold text-afs-chrome-high mb-3">Check Your Email</h1>
      <p className="font-body text-sm text-afs-chrome-mid mb-8">
        If an account exists for that email, we sent a password reset link.
      </p>
      <Link href="/login" className="font-label text-sm text-afs-danger-on-dark hover:text-afs-chrome-high">
        Back to sign in
      </Link>
    </div>
  );
}
