# DNS_MIGRATION_CHECKLIST.md
## AFS — Go-Live DNS / Domain Cutover

This is the same 4-step checklist that lives in STATE_OF_THE_BUILD.md's
"DNS MIGRATION CHECKLIST" section, expanded with exact dashboard
navigation, plus a final verification step. Perform these in order.

**Codebase status (verified afs-dns-001, 2026-07-22):** a full-repo
search (excluding `node_modules`, `.next`, `machine-data/`) for the
literal preview domain `afs-website-alpha.vercel.app` and the bare
substring `vercel.app` found **zero hardcoded references in application
code**. The only hits were in governance docs (STATE_OF_THE_BUILD.md,
SESSION_STATE.md) describing the current preview URL as documentation,
and `.env.example`'s own commented placeholder — neither is a code
reference that would survive a domain change. `next.config.js`'s
`images.remotePatterns` only allowlists the Supabase Storage hostname,
not a Vercel domain. The two places that build a redirect URL at runtime
(`app/(auth)/login/page.tsx`, `app/(auth)/forgot-password/page.tsx`) both
use `window.location.origin` dynamically, not a hardcoded string. This
means the cutover below really is config-only — no code deploy is
required to point the app at the live domain, only the 3 external
dashboard changes plus a redeploy.

---

### Step 1 — Vercel: update the public app URL

**Where:** Vercel dashboard → select the `afs-website` project →
**Settings** → **Environment Variables**.

- Find `NEXT_PUBLIC_APP_URL` (currently
  `https://afs-website-alpha.vercel.app`).
- Edit its value for the **Production** environment to the live domain
  (e.g. `https://architecturalflashingsupply.com`).
- Save. This does not take effect until the next deploy (see Step 5).

---

### Step 2 — Supabase: update the Auth Site URL

**Where:** Supabase dashboard → select the AFS project →
**Authentication** → **URL Configuration**.

- Update **Site URL** from the current preview domain to the live domain.
- Under **Redirect URLs**, add the live domain's auth callback
  (`https://<live-domain>/auth/callback`) — needed for magic-link and
  password-reset redirects (`app/(auth)/forgot-password/page.tsx` builds
  this URL from `window.location.origin` at request time, so once a user
  is on the live domain it will correctly send them back there; Supabase
  still needs the URL allow-listed here or it will reject the redirect).
- Leave the preview domain's entry in place until the preview deployment
  is retired, if it's still used for staging.

---

### Step 3 — Stripe: update the webhook endpoint URL

**Where:** Stripe Dashboard → **Developers** → **Webhooks** → the
existing endpoint (currently pointed at
`https://afs-website-alpha.vercel.app/api/webhooks/stripe`).

- Open the existing endpoint (do not create a second one unless the old
  one must stay live for the preview environment during the transition).
- Update its URL to `https://<live-domain>/api/webhooks/stripe`.
- Stripe issues a new signing secret only if a *new* endpoint is created,
  not on a URL edit to an existing one — if a new endpoint is created
  instead, update `STRIPE_WEBHOOK_SECRET` in Vercel's environment
  variables (Step 1's location) to match.

---

### Step 4 — Redeploy on Vercel after the env var change

**Where:** Vercel dashboard → the `afs-website` project → **Deployments**
tab → redeploy the current Production deployment (or push a new commit),
so the build picks up Step 1's updated `NEXT_PUBLIC_APP_URL`.

---

### Step 5 — Confirm the build against the new value before calling this done

- After the redeploy, confirm the Vercel build log shows the deployment
  succeeded (exit 0) using the new `NEXT_PUBLIC_APP_URL`.
- Locally, this is the same gate every FORGE prompt already runs:
  `pnpm tsc --noEmit` (must be 0 errors) and `pnpm run build` (must exit
  0) — run these once more after Step 1's value changes, so a bad env
  value is caught before it's called a completed cutover, not after.
- Spot-check in the browser on the live domain: sign in (confirms
  Supabase Step 2), submit a test quote request, and confirm a Stripe
  checkout webhook is received (confirms Step 3) — do not consider the
  cutover complete until all three are exercised for real, not just
  configured.

---

*DNS_MIGRATION_CHECKLIST.md | AFS | Generated afs-dns-001, 2026-07-22.*
