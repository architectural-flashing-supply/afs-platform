'use client';

/**
 * THE LAST BOUNDARY (F-06, audit 2026-09-24 — "zero error boundaries anywhere
 * in the app").
 *
 * Next.js App Router renders `app/global-error.tsx` when a render error escapes
 * every other boundary, INCLUDING one thrown inside the root layout itself.
 * Because the root layout is the thing that failed, this file has to supply its
 * own <html> and <body> — that is a framework requirement, not a stylistic
 * choice, and it is why the colours here are inline rather than Tailwind
 * classes: the stylesheet is imported by the layout that just died, so no
 * afs-* class is guaranteed to resolve at this point.
 *
 * CLAUDE.md rule #4's CANVAS_COLORS exception covers exactly this shape of
 * problem — a surface that cannot consume Tailwind classes needs literal
 * values from one documented constant that mirrors the tokens. GLOBAL_ERROR_COLORS
 * below is that constant for this file.
 *
 * Contrast, measured (WCAG 2.1 1.4.3), because this screen is no less
 * accountable to the design rule than any other:
 *   ink on surface      #111111 on #F7F7F5   18.9:1
 *   muted on surface    #374151 on #F7F7F5   10.3:1
 *   white on crimson    #FFFFFF on #C0001A    5.9:1
 */

// Mirrors afs-bg-light / afs-ink-900 / afs-ink-700 / afs-crimson /
// afs-border-light from tailwind.config.js as literal hex. See the header
// comment above and CLAUDE.md rule #4's CANVAS_COLORS exception.
const GLOBAL_ERROR_COLORS = {
  surface: '#F7F7F5',
  card: '#FFFFFF',
  ink: '#111111',
  muted: '#374151',
  line: '#D8D8D4',
  action: '#C0001A',
  actionText: '#FFFFFF',
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: GLOBAL_ERROR_COLORS.surface,
          color: GLOBAL_ERROR_COLORS.ink,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '24px',
        }}
      >
        <main
          data-testid="global-error"
          style={{
            maxWidth: 560,
            width: '100%',
            background: GLOBAL_ERROR_COLORS.card,
            border: `1px solid ${GLOBAL_ERROR_COLORS.line}`,
            borderRadius: 6,
            padding: '28px',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 24, lineHeight: 1.2 }}>
            Something went wrong on this page
          </h1>
          <p style={{ margin: '0 0 16px', color: GLOBAL_ERROR_COLORS.muted, fontSize: 16, lineHeight: 1.5 }}>
            Nothing you were working on was sent anywhere. Try loading the page again. If it keeps
            happening, tell Reid and give him the reference code below.
          </p>
          {error.digest ? (
            <p
              data-testid="global-error-digest"
              style={{ margin: '0 0 20px', color: GLOBAL_ERROR_COLORS.muted, fontSize: 14 }}
            >
              Reference code: <strong style={{ color: GLOBAL_ERROR_COLORS.ink }}>{error.digest}</strong>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              appearance: 'none',
              border: 'none',
              borderRadius: 4,
              background: GLOBAL_ERROR_COLORS.action,
              color: GLOBAL_ERROR_COLORS.actionText,
              fontSize: 16,
              fontWeight: 600,
              padding: '14px 22px',
              minHeight: 48,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
