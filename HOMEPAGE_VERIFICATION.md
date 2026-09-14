# HOMEPAGE_VERIFICATION.md
## Homepage Redesign — `feat/homepage-redesign` — Release Candidate Walkthrough for Reid

**Read this top section before clicking anything.** This branch does
**not** put a new-looking homepage in front of you. `app/page.tsx` — the
file that actually renders `/` — was never touched by any `hp-` commit.
What you'll see at the preview URL below is the *current production
homepage*, unchanged. The real new work (eleven section components plus
a redesigned nav/footer) exists as real, compiling code, but only one
piece of it is wired into an actual page you can click to. Full detail
and every file path: `STATE_OF_THE_BUILD.md`'s "HOMEPAGE REDESIGN —
RELEASE CANDIDATE GOVERNANCE AUDIT (hp-024)" entry at the top of that
file.

This checklist is scoped to **what is actually reachable in a browser
today.** It does not walk you through sections that don't render
anywhere — doing that would waste your time clicking into 404s or
nothing at all.

---

## PREVIEW URL

Pushing this branch (step below) gives Vercel a new branch-preview
deployment. Vercel's naming pattern for this project (confirmed against
`main`'s own deployments) is:

```
https://afs-website-git-feat-homepage-redesign-steveharyckis-projects.vercel.app
```

If that URL 404s or shows a build-in-progress page, give it a minute —
the deployment triggers on push and takes a short build cycle. If it
still doesn't resolve, check the Vercel dashboard
(vercel.com/steveharyckis-projects/afs-website/deployments) for the
actual branch-preview URL rather than assuming the pattern above is
wrong.

**What you'll see at `/` on that URL:** the current, unchanged
production homepage (real shop-floor photo hero, "TEXAS CRAFTED.
NATIONALLY DELIVERED.", photo category grid, project gallery) — this
branch did not touch it.

---

## PART 1 — WHAT'S ACTUALLY LIVE (check these)

### 1a. NavBar + Footer (hp-020) — global chrome, visible on every page

This is real and live-checkable on any public page (e.g. the homepage
itself, or `/products`).

- [ ] Desktop header: logo top-left, no left rail (just a single 56px
      header bar to its right)
- [ ] "Start a Quote" crimson button is visible in the header at all
      times, routes to `/design-studio`
- [ ] "Resources" dropdown opens on click, contains Resources + HailView
      links, closes on an outside click
- [ ] Press Escape while the Resources dropdown is open — it closes and
      focus returns to the dropdown button
- [ ] FAQ and Contact are gone from the top-level header links (Contact
      is still reachable via the footer)
- [ ] Shrink the browser below `md` width (or use device toolbar) — a
      hamburger icon appears; it did not exist before this branch
- [ ] Tap the hamburger — a slide-down panel opens listing every link
      (Resources items flattened, not nested) plus Start a Quote again
      at the bottom
- [ ] Footer's Resources column now includes an FAQ link

### 1b. `/design-studio` — the one redesign section that's actually live

- [ ] Visit `/design-studio` directly (not linked from the old homepage
      — only reachable via the new NavBar's "Design Studio" link, which
      still points at the older `/studio` — or by typing the URL)
- [ ] Five method cards render: Scan Plans, Photo to Quote, FlashDraft,
      Configurator, Quick Quote
- [ ] Click through each card — the detail panel below updates, showing
      a description, a "Best for" line, and a Start button
- [ ] Arrow keys (Left/Right/Up/Down, Home/End) move selection between
      cards when a card has focus
- [ ] Each "Start" button lands on a real page: `/upload`,
      `/field/contractor`, `/studio/draft`, `/configure`, `/quote`

---

## PART 2 — WHAT ISN'T LIVE (nothing to click — informational only)

These eleven components (`hp-001` through `hp-014`) are real, compiling
files under `app/components/hero/` and `app/components/home/`, but none
of them are imported by `app/page.tsx` or any other route. There is
**no URL where you can see them assembled as a homepage.** Reviewing
them means reading the component files directly or asking for a
temporary preview route — not browsing this branch's deployment.

`HeroSection` + `ProfileRotation` (hp-002/003) · `CredibilityStrip`
(hp-004) · `FieldAppStory` (hp-005) · `DesignToDelivery` (hp-008) ·
`CustomerPathways` (hp-009) · `ProfilePassportExplainer` (hp-010) ·
`CaseStudies` (hp-011) · `ShopFloorProof` (hp-012) · `NationwideMap`
(hp-013) · `FinalCTA` (hp-014)

**If you want to actually see these assembled**, the next step is a
real "assembly" pass — importing all eleven into `app/page.tsx` in
order, retiring the current hero/`PhotoCategoryGrid`/`ProjectGallery`.
That pass was always planned (every one of these components' own
governance entries calls it `hp-019`) but never happened. See
`STATE_OF_THE_BUILD.md`'s hp-024 entry, item 0 in NEXT ACTION, for the
decision this implies: assemble before merging, or merge this as
prep/infrastructure and assemble in a follow-on branch.

## PART 3 — PROFILE PASSPORT (hp-015) — does not exist as working software yet

**There is no save → My Profiles → reorder flow to test.** What exists:
a database migration file (`supabase/migrations/023_profile_passport.sql`)
that has **not been applied to the live database** (the session that
wrote it couldn't link to the Supabase project — see that file's own
header comment and `STATE_OF_THE_BUILD.md`'s PROFILE PASSPORT entry for
the exact blocker), and zero application code — no save API, no
`/account/profiles` or passport-specific page, no reorder UI anywhere in
the codebase. The only thing you can look at is
`ProfilePassportExplainer.tsx`, a marketing explainer section (Design →
Save → Reorder, with an illustrative example card) — and per Part 2
above, even that isn't wired into a live page yet.

Do not spend time looking for this flow in the preview. There's nothing
there.

---

## MERGE AND DEPLOY — RUN ONLY AFTER YOU'VE SIGNED OFF ABOVE

```bash
git checkout main
git merge --no-ff feat/homepage-redesign
git push origin main
```

**Then the production deploy step.** The task this doc was written for
assumed a `deploy.ps1` in the project root — **it does not exist**,
checked directly (`find`, and no `deploy*` script anywhere in the repo
or in `package.json`'s `scripts` block). This project's real deploy
mechanism is Vercel's GitHub integration: every one of the last 20
production deployments (checked via the Vercel API this pass) was
triggered automatically by a push to `main`, not a manual script. So the
`git push origin main` above **is** the deploy step — no further command
is needed. If you'd specifically like a manual `deploy.ps1` (for
redeploys without a new commit, preview promotion, etc.), that doesn't
exist yet and would need to be written as its own task.

---

## OTHER FLAGS FROM THIS PASS, NOT PART OF THIS BRANCH'S SCOPE

Found while auditing the working tree for this pass, left untouched and
**not included in this branch's commit** — worth your attention
separately:

- **`queue.yaml` has an uncommitted, unrelated modification** sitting in
  the working tree (a full rewrite from the committed `p0-`/`p1-`...
  format to a different `afs-001`...`afs-024` format). It predates this
  session and has nothing to do with the homepage redesign — neither
  version has ever tracked an `hp-` prompt. Left unstaged.
- **`EMAIL PROSPECT LISTS/`** — real TBAE architect/ID/LA roster
  spreadsheets sitting untracked in the repo root. Not committed.
- **`.repro-afs-fl-023/`, `.repro-afs-fl-025/`, `.repro-afs-fl-029/`** —
  bug-repro screenshots/scripts from unrelated prior tickets, untracked.
- **`supabase/.temp/`** — local Supabase CLI cache, untracked.

None of these were created by this pass and none are referenced by the
homepage redesign — flagged so they don't get lost, not folded into this
commit.
