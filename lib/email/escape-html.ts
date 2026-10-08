/**
 * HTML escaping for values interpolated into an outbound email body.
 *
 * ONE COPY. This was `escapeHtml` inside lib/quotes/email-template.ts, which
 * used it correctly on every interpolated value. The HailView email report
 * route was written without it and interpolated eleven caller-supplied
 * strings raw — see lib/hailview/email-report-html.ts's header. Extracted
 * here so there is one escaper and the next email template has an obvious
 * thing to import rather than a reason to write its own.
 *
 * Escapes the four characters that can break out of HTML text or an
 * attribute value. `'` is deliberately NOT escaped: every interpolation site
 * in this codebase uses double-quoted attributes, and `&#39;` in a plain
 * sentence renders as mojibake in some older mail clients. If a single-quoted
 * attribute is ever introduced, escape it there or add it here — do not leave
 * the site unescaped.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Collapses an untrusted string to a single line and caps its length, for
 * use in an email SUBJECT.
 *
 * Resend's REST API takes JSON, so a newline here is not SMTP header
 * injection — but a subject containing a newline is still malformed, and a
 * subject carrying several hundred characters of attacker-chosen text is a
 * phishing payload in the one line a recipient sees before opening anything.
 */
export function singleLineForSubject(value: string, maxLength = 120): string {
  const collapsed = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}
