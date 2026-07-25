// Shared HTML email shell. Colors below are literal hex, not afs-* Tailwind
// tokens or CSS custom properties — email clients render this HTML in
// isolation and can't resolve either, the same constraint already
// documented for CANVAS_COLORS and STRIPE_CARD_ELEMENT_COLORS
// (DESIGN_TOKENS.md §10). Mirrors the *real* current gunmetal tokens
// (DESIGN_TOKENS.md §2) rather than SPEC_RESEND_INTEGRATION.md §3's literal
// example values (#1A1A1E/#D8E0EC/#6B7A94), which predate the current
// design system and don't match any real token.
const COLORS = {
  bgDim: '#1C1F26',
  crimson: '#C0001A',
  chromeHigh: '#FFFFFF',
  chromeDim: '#7A8299',
  inkOnWhite: '#111111',
};

// No street address or unsubscribe link in the footer — CLAUDE.md's DATA
// BLOCKERS table lists the AFS address as blocked (#5/#6); this follows the
// same "explicit placeholder behavior, not a fabricated value" rule already
// applied everywhere else in this codebase rather than inventing one.
export function baseEmailTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;background:${COLORS.bgDim};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="background:${COLORS.bgDim};padding:24px 0;text-align:center;">
      <span style="font-size:28px;font-weight:700;color:${COLORS.chromeHigh};letter-spacing:4px;">AFS</span>
      <div style="font-size:10px;color:${COLORS.chromeDim};letter-spacing:3px;margin-top:4px;">
        ARCHITECTURAL FLASHING SUPPLY
      </div>
    </td></tr>
    <tr><td style="background:${COLORS.crimson};height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="background:#FFFFFF;padding:40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
        <tr><td style="color:${COLORS.inkOnWhite};font-size:14px;line-height:1.6;">
          ${content}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="background:${COLORS.bgDim};padding:24px;text-align:center;">
      <p style="color:${COLORS.chromeDim};font-size:12px;margin:0;">
        AFS Architectural Flashing Supply
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A crimson call-to-action button — used for the tracking link in the dispatch email. */
export function ctaButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${COLORS.crimson};border-radius:4px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${label}</a>
  </td></tr></table>`;
}
