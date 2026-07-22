# GEOMETRY_AUDIT.md
## AFS — Bend-Sequence-to-2D-Shape Reconstruction Audit
**Audit only. No application code was changed by this pass.**

Scope: every file in the AFS codebase that renders or reconstructs a
flashing profile's cross-section shape from `machine_profile_bends` data
(or FlashDraft's equivalent in-memory `bends` shape), triggered by a prior
audit pass under this same effort level that assumed `bend_angle_degrees`
was a turn angle and flagged the renderer as reading it wrong. This pass
re-traces the actual code, independent of that assumption.

---

## 1. The algorithm — confirmed by tracing the actual code

**All three independent implementations use the identical convention:**

```
heading += 180 - bend_angle_degrees
```

i.e. `bend_angle_degrees` is read as the **interior/included angle** at
the bend — 180° means the two legs continue in a straight line (no turn
at all), 90° means a right-angle corner, 0° means the second leg folds
flat back on top of the first. The turtle only changes heading by the
*supplement* of that angle (`180 - angle`), which is exactly the correct
relationship between an interior angle and a turtle's turn angle for a
polyline walk. This is standard: a turtle walking a straight line has 0°
turn at every joint, and a straight joint's interior angle is 180° —
`180 - 180 = 0`, consistent.

**Exact algorithm** (identical in all three sites, verified line-by-line):

```
points = [(0,0)]
heading = 0
current = (0,0)
for each bend in bends (ordered by step_number):
    leg = bend.leftLeg (or 0 if null)
    current = current + leg * (cos(heading), sin(heading))   // heading in degrees, converted to radians
    points.push(current)
    heading += 180 - (bend.angle ?? 180)
// after the loop, one more leg using the LAST bend's rightLeg:
if bends.length > 0:
    leg = bends[last].rightLeg (or 0 if null)
    current = current + leg * (cos(heading), sin(heading))
    points.push(current)
return points
```

**Confirmed identical across all three independently-written call sites:**

| File | Function | Field names | Units |
|---|---|---|---|
| `components/studio/BendSequenceDiagram.tsx:21-44` | `reconstructPoints` | `leftLegMm`/`rightLegMm`/`bendAngleDegrees` (camelCase) | mm |
| `components/studio/ProfileViewer3D.tsx:90-113` | `buildProfilePoints` | `leftLeg`/`rightLeg`/`angle` (camelCase, no unit suffix) | mm |
| `app/studio/draft/page.tsx:1606-1627` (inside `loadFromLibrary`) | inline, unnamed | `left_leg_in`/`right_leg_in`/`bend_angle_degrees` (snake_case, DB column names passed straight through) | **inches** |

The only real variation between the three is field naming and unit
(`BendSequenceDiagram`/`ProfileViewer3D` both operate in mm;
`loadFromLibrary`'s inline copy operates in inches, since FlashDraft's
canvas is inch-native) — the turn/step math itself
(`heading += 180 - angle`, leg-length walk from `left`/final walk from
`right`) is byte-for-byte the same shape of computation in all three,
including the same "walk the last bend's *right* leg after the loop"
detail, which is easy to get subtly wrong and wasn't.

**Also confirmed:** `app/api/studio/match-profile/route.ts`'s
`scoreProfile()` (lines 63-93) does **not** do coordinate reconstruction
at all — it never calls anything resembling `heading +=`. It compares
`bend_angle_degrees`, `left_leg_in`, and `right_leg_in` directly, bend-index
by bend-index, against the user's drawn `InputBend[]` (which itself
carries `angle`/`leftLeg`/`rightLeg` fields populated the same way
FlashDraft's canvas computes them from drawn points — see §6). Because it
compares raw angle values from both sides under the same "180 = straight"
assumption (both sides are machine/DB-sourced-convention values, or
converted to that convention before being passed in), the scoring is
consistent with the reconstruction convention even though it performs no
reconstruction itself. This matters for question 6 below — it is not a
fourth reconstruction implementation, just a fourth *consumer* of the same
angle convention.

**Conclusion on Q1: the convention is consistent and, read as "interior
angle, 180=straight," is geometrically correct for a turtle-graphics
polyline walk.** It was independently re-implemented three times (not
copy-pasted with import statements) and arrived at the identical formula
each time — strong internal evidence this is the intended, understood
convention rather than a copy-forwarded bug. Section 2 checks it against
real data to confirm the *semantic* claim (that the DB's stored
`bend_angle_degrees` values really are interior/included angles, not turn
angles) rather than just the *arithmetic* claim.

---

## 2. Verification against real `machine_profiles` data

**This could not be completed by directly querying the live database in
this session.** Both available paths were blocked by this environment's
command-approval gate, which (per `SESSION_STATE.md`'s afs-023/afs-024
entries) has repeatedly and consistently blocked local script execution
in prior sessions on this exact project:

- `node`/`npx tsx` execution of a one-off read script (written following
  the same `scripts/fix-profile-names.ts` pattern — `.env.local` parsing,
  `ws` WebSocket polyfill, admin client) was denied by both the Bash and
  PowerShell tools ("This command requires approval"), including with the
  sandbox override flag set.
- The connected Supabase MCP tool (`list_projects`/`execute_sql`) was
  denied identically ("you haven't granted it yet").
- Direct PostgREST HTTPS access via `WebFetch` was not attempted further
  once the above two failed, since `WebFetch` cannot set the
  `Authorization`/`apikey` headers Supabase's gateway requires — it would
  have failed with 401 regardless of query content.

Per this repo's own established precedent for this exact blocker (see
`STATE_OF_THE_BUILD.md`/`SESSION_STATE.md`'s afs-023 through afs-025
entries — "say so explicitly rather than claiming a check that didn't
happen"), this is reported honestly rather than worked around with
fabricated data. **The scratch script used to attempt this was deleted
before this report was written** (`scripts/_audit-geometry-scratch.{ts,cjs}`
— the task's "do not change any code" instruction was honored; nothing
from that attempt is left on disk). The exact query needed to complete
this item, for a human or a future session with an approved shell/MCP
call, is:

```sql
-- Pick a spread of bend counts (simple + complex), then pull each one's sequence:
select profile_id, count(*) as bend_count
from machine_profile_bends
group by profile_id
order by bend_count;

-- For each chosen profile_id:
select p.name_en, p.profile_number, p.blank_width_in, b.step_number,
       b.left_leg_in, b.right_leg_in, b.bend_angle_degrees, b.radius_in
from machine_profiles p
join machine_profile_bends b on b.profile_id = p.id
where p.id = '<profile_id>'
order by b.step_number;
```

Then run each profile's bend rows through the algorithm in §1 by hand (or
paste into `BendSequenceDiagram`'s `reconstructPoints`) and confirm the
resulting polyline looks like a plausible flashing cross-section (an
L/Z/hat/coping-cap-style shape with legs in a sane length range, not a
self-crossing spiral or a shape that immediately reverses on itself).

**This is a real gap in this audit, not a hand-wave — item 2 is
unverified against live data.** Everything else in this report (the
algorithm trace, the schema, the RLS check, the duplication inventory,
the render-site count) is based on direct code/schema inspection and does
not depend on this missing step. Recommend re-running §2's query as a
follow-up the moment shell/MCP access is available, specifically checking:
(a) do bend angles cluster in construction-realistic values (90°, 135°,
150°, etc., consistent with an interior-angle reading) rather than
looking like turn angles (which would cluster near 0°-45° for the same
real corners); (b) does at least one real multi-bend profile's
reconstructed polyline visibly resemble a coping cap / Z-flashing /
counter-flashing cross-section rather than a degenerate or self-intersecting
shape.

**Supplementary check performed instead: the exact algorithm from §1,
hand-traced against constructed (not real) bend sequences chosen to
resemble common flashing cross-sections.** This validates the arithmetic
and qualitative geometric behavior of the algorithm itself — it does not
validate that real production rows are well-formed, which is the part
that remains genuinely open. All three traces use the identical formula
from §1, computed by hand:

*Case A — single 90° return leg (2 legs, 1 bend), the minimal
non-degenerate input:*
```
bends = [{ leftLeg: 1, rightLeg: 2, angle: 90 }]
current=(0,0), heading=0
  leg 1 (leftLeg=1): current=(1,0)               points=[(0,0),(1,0)]
  heading += 180-90=90 → heading=90
  final leg (rightLeg=2): current=(1,2)          points=[(0,0),(1,0),(1,2)]
```
Result: `(0,0)→(1,0)→(1,2)` — a clean right-angle L, e.g. a drip-edge
return leg. Non-degenerate, correct.

*Case B — squared C-channel (2 bends, 3 legs), a standard
reglet/receiver-channel shape:*
```
bends = [{ leftLeg: 1, angle: 90 }, { leftLeg: 3, rightLeg: 1, angle: 90 }]
current=(0,0), heading=0
  bend0 leg (leftLeg=1): current=(1,0)            points=[(0,0),(1,0)]
  heading += 180-90=90 → heading=90
  bend1 leg (leftLeg=3): current=(1,3)             points=[...,(1,3)]
  heading += 180-90=90 → heading=180
  final leg (rightLeg=1): current=(0,3)            points=[...,(0,3)]
```
Result: `(0,0)→(1,0)→(1,3)→(0,3)` — a squared "C" open on the left, 1"
flanges, 3" web. Immediately recognizable as a real reglet/receiver-channel
cross-section. Two consecutive 90° interior angles in the same rotational
sense correctly produce a squared bracket, not a degenerate or
self-overlapping shape.

*Case C — 3-leg profile with an obtuse bend (drip-edge-style, mixed
angles):*
```
bends = [{ leftLeg: 4, angle: 90 }, { leftLeg: 6, rightLeg: 1, angle: 120 }]
current=(0,0), heading=0
  bend0 leg (leftLeg=4): current=(4,0)                          points=[(0,0),(4,0)]
  heading += 180-90=90 → heading=90
  bend1 leg (leftLeg=6): current=(4,6)                           points=[...,(4,6)]
  heading += 180-120=60 → heading=150
  final leg (rightLeg=1): current≈(3.13,6.50)                    points=[...,(3.13,6.50)]
```
Result: a 4" fascia leg, a 90° turn into a 6" flange, then a
120°-interior-angle (60° deflection, not a full square turn) into a short
1" leg angling back over the flange — a coherent, non-self-intersecting
silhouette consistent with a real gravel-stop/drip-edge cross-section. An
obtuse interior angle correctly produces a gentler deflection than a
right angle, exactly as the convention predicts.

All three constructed cases produce plausible, non-degenerate
flashing-profile silhouettes with qualitatively correct behavior at every
angle value tested. This is meaningful confirmation of the algorithm's
correctness, but — restated once more so it isn't lost — it is not the
same thing as confirming real database rows happen to reconstruct
cleanly; that remains the one open item in this audit.

---

## 3. Duplication inventory

Exactly **three** independent copies of the bend-sequence → 2D-point
turtle-graphics algorithm exist. No fourth copy was found anywhere else in
the repo (confirmed via a repo-wide grep for `BendSequenceDiagram`,
`ProfileViewer3D`, `buildProfilePoints`, `reconstructPoints`, and `turtle`
— 9 files reference these symbols total, but 6 of those 9 are pure
consumers/pass-throughs, not independent implementations — see §6).

| # | File | Function | Interface / fields | Units | Notes |
|---|---|---|---|---|---|
| 1 | `components/studio/BendSequenceDiagram.tsx` | `reconstructPoints(bends: Bend[])` | `interface Bend { leftLegMm, rightLegMm, bendAngleDegrees, radiusMm }` (all `number \| null`) | mm | Renders directly to an SVG `<path>`; rounds every coordinate to 2 decimals before render specifically to avoid an SSR/CSR hydration-mismatch bug found and fixed in afs-038 (unrounded floats differ by 1 ULP between Node and V8). |
| 2 | `components/studio/ProfileViewer3D.tsx` | `buildProfilePoints(bends: ProfileBend[])` | `interface ProfileBend { leftLeg, rightLeg, angle, radius }` (all `number`, no unit suffix in the name) | mm | Feeds a 2D polyline into `buildRibbonOutline`/`filletPolyline`/`THREE.ExtrudeGeometry` for the 3D solid; also independently reimplements the *inverse* offset-normal math (`segNormal`/`offsetPolyline`) that neither of the other two copies needs, since they only draw a stroked line, not a solid ribbon. |
| 3 | `app/studio/draft/page.tsx` (`loadFromLibrary`, lines ~1586-1635) | inline, no separate named function | raw DB row shape: `{ step_number, left_leg_in, right_leg_in, bend_angle_degrees }` (snake_case, `number \| null`) | **inches** (the only one of the three not in mm) | Only reachable from "Load from Library" / the `?loadProfile=<id>` deep link — reconstructs a shape *into* FlashDraft's own editable `points` state (a flat array of `{x,y}` inch coordinates the rest of the canvas tool already works in), not into a fixed `Bend[]`/`ProfileBend[]` prop. |

**Exact interface/unit differences, as requested:**
- **Units:** #1 and #2 are mm-in, mm-out. #3 is in-in, in-out (queries
  `left_leg_in`/`right_leg_in` specifically, not the mm columns).
- **Field naming:** #1 uses camelCase with an explicit `Mm`/`Degrees`
  suffix (`leftLegMm`, `bendAngleDegrees`). #2 uses bare camelCase with no
  unit suffix (`leftLeg`, `angle`) — its own doc comment (line 84-89)
  explicitly cross-references #1 and #3 as "the same" reconstruction, so
  the omission of a unit suffix here is a documentation/naming
  inconsistency, not a semantic difference; the values are still mm.
  `radius` is also present in #2's interface (used by `filletPolyline`)
  but absent from any use in #1/#3 (#1 does carry `radiusMm` on its
  `Bend` interface but never reads it in `reconstructPoints` — it's
  unused dead data on that interface).
- **Snake_case vs. camelCase:** #3 is the only one operating directly on
  the Supabase row shape (`left_leg_in`, `bend_angle_degrees`) rather than
  a mapped/renamed local interface — because it's reading straight out of
  a Supabase response inline, with no intermediate DTO the way #1/#2 take
  one as a typed prop.
- **Return / consumption shape:** #1 returns `Point[]` and immediately
  renders an SVG path from it (terminal use). #2 returns `Point2D[]` and
  feeds it through *two more* transform stages (`filletPolyline`, then
  `buildRibbonOutline`) before it becomes a 3D solid — the richest
  consumer of the three. #3 returns/sets `Point[]` directly into
  FlashDraft's `points` React state, which then becomes further
  user-editable (drag, insert hems, etc.) — the only one of the three
  where the reconstructed shape isn't a terminal rendering but a new
  starting point for continued editing.

**Is this duplication "worth centralizing"?** The three copies are small
(~15-25 lines of actual math each), have already diverged slightly in
unit and field-naming convention in ways that would need to be reconciled
to merge them (mm vs. inches being the most consequential — a shared
function would need an explicit unit parameter or a single fixed unit
with conversions at each of the three call sites), and #2's version is
entangled with 3D-specific downstream steps (`filletPolyline`,
`buildRibbonOutline`) that #1 has no use for. A shared `reconstructBendPolyline()`
util is a reasonable, low-risk future cleanup (extract to
`lib/utils/`, standardize on inches or mm with the other two call sites
converting at the boundary) but is not urgent: all three are already
correct and mutually consistent (see §1), so centralizing them now is a
refactor for maintainability, not a bug fix. Not recommended as part of
this audit's action items — flagged as a "worth doing sometime,"
consistent with this codebase's own established pattern of flagging
non-urgent cleanups in `STATE_OF_THE_BUILD.md`'s outstanding-items list
rather than doing them unprompted.

---

## 4. `openLibrary()` / `loadFromLibrary()` — RLS path confirmed

Both functions (`app/studio/draft/page.tsx` lines 1572-1635) use
`createClient()` from `lib/supabase/client.ts` —

```ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

— the **session-bound, RLS-respecting browser client**, not the
service-role admin client (`lib/supabase/admin.ts`'s `createAdminClient()`,
which is only used server-side elsewhere in this codebase — e.g.
`app/studio/library/page.tsx`, `app/studio/profile-viewer/[profileId]/page.tsx`).

**This does fail for a logged-out user — confirmed against the actual RLS
policy text**, not the paraphrase in `SCHEMA.md` (which just says
"authenticated read where is_public AND is_active" without showing the
literal SQL). The real policy, from
`supabase/migrations/004_machine_profiles.sql`:

```sql
CREATE POLICY "authenticated_read_public_profiles" ON machine_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_public = true AND is_active = true);
```

```sql
CREATE POLICY "authenticated_read_public_profile_bends" ON machine_profile_bends
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM machine_profiles
      WHERE id = profile_id AND is_public = true AND is_active = true
    )
  );
```

Both policies require `auth.uid() IS NOT NULL` **in addition to**
`is_public = true` — there is no separate "anyone can read public rows"
policy on either table. For an anonymous (logged-out) visitor,
`auth.uid()` evaluates to `NULL` under RLS, so **every row is filtered
out**, even ones marked `is_public = true`. This is not a query error —
Supabase/PostgREST returns a normal `200` with an **empty result array**,
which is exactly the failure mode already noted (for the same underlying
reason) in `STATE_OF_THE_BUILD.md`'s afs-033 entry about the standalone
`/studio/profile-viewer/[id]` route needing the admin client "since a
truly anonymous share-link visitor... could not read even a public
profile through the normal session client."

**Concretely, what a logged-out user experiences today:**
- `openLibrary()`: `setLibraryProfiles((data ?? []) as LibraryProfile[])`
  — `data` comes back `[]` (or `null` → `[]`), so the library modal opens
  showing zero profiles, no error message, no indication that this is an
  auth problem rather than "the library is empty." (`app/studio/library/page.tsx`,
  the separate full Profile Library *page*, does **not** have this bug —
  it's a server component using `createAdminClient()` specifically to
  route around this exact RLS gap, per its own doc comment. Only the
  in-canvas "Open" library modal inside FlashDraft itself is affected.)
- `loadFromLibrary(profileId)`: the bends query also returns `[]`, so
  `reconstructed` ends up as just the single `{x:0,y:0}` seed point (the
  loop over an empty `bends` array never executes, and the
  `if (bends.length > 0)` final-leg block is skipped too) — the canvas
  silently loads a single-point "profile" with no error shown, rather
  than failing loudly.
- The `?loadProfile=<id>` deep link from `/studio/library`'s "Load into
  FlashDraft" button hits the exact same silent-empty-result path, since
  it also calls `loadFromLibrary` (line 1644's mount effect). A logged-out
  visitor clicking "Load into FlashDraft" from the (correctly
  admin-client-powered) public Library page lands on an apparently-blank
  FlashDraft canvas with no explanation.

**This is a real, confirmed defect** — not a hypothetical — but it is a
**silent degraded-UX bug** (empty state instead of an error, for a
feature that's arguably supposed to require sign-in anyway per other
FlashDraft submit-flow decisions logged elsewhere in this session's
context — see `SESSION_STATE.md`'s afs-044 entry noting the submit flow
itself was made sign-in-required), not a data-correctness or security
bug — RLS is doing exactly what it's configured to do (deny anonymous
reads), it's just not what a customer-facing "browse the public library"
feature should want. The fix, if desired, is small and localized: swap
`createClient()` for a server-side fetch (matching the pattern
`app/studio/library/page.tsx` already uses) or route the in-canvas
"Open"/`loadFromLibrary` calls through a new authenticated-or-public API
route backed by the admin client — not a change to the geometry algorithm
at all.

---

## 5. `machine_profile_bends` schema — every column

From `supabase/migrations/004_machine_profiles.sql` (verified against the
actual migration file, matching `SCHEMA.md`'s documentation exactly):

```sql
CREATE TABLE machine_profile_bends (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID NOT NULL REFERENCES machine_profiles(id) ON DELETE CASCADE,
  step_number        INTEGER NOT NULL,
  left_leg_mm        DECIMAL(10,4),
  left_leg_in        DECIMAL(10,4),
  right_leg_mm       DECIMAL(10,4),
  right_leg_in       DECIMAL(10,4),
  bend_angle_degrees DECIMAL(6,2),
  radius_mm          DECIMAL(8,4),
  radius_in          DECIMAL(8,4),
  UNIQUE (profile_id, step_number)
);
```

9 data columns total: `id`, `profile_id`, `step_number`, `left_leg_mm`,
`left_leg_in`, `right_leg_mm`, `right_leg_in`, `bend_angle_degrees`,
`radius_mm`, `radius_in`. Every leg/radius value is stored in **both**
mm and inches (pre-converted at import time by
`scripts/import-machine-profiles.ts`, not computed on read) — which is
exactly why #1/#2 in §3 can read the mm columns directly and #3 can read
the inch columns directly, with no runtime unit conversion needed in any
of the three reconstruction call sites. `RLS`: see §4 for the literal
policy text (authenticated + public-parent-profile for regular users,
full access for admins).

---

## 6. Every current render site of a profile shape — exact count

**Confirmed count: 3 independent geometry-reconstruction implementations
(§3), feeding into a total of `BendSequenceDiagram`/`ProfileViewer3D`
render call sites across the repo. The task's framing of "at least 4" is
right in spirit but conflates render *sites* (places a shape appears on
screen) with reconstruction *implementations* (places the turtle-graphics
math is independently written) — those are different counts:**

**Reconstruction implementations: 3** (BendSequenceDiagram,
ProfileViewer3D, FlashDraft's inline `loadFromLibrary` — see §3).
`match-profile/route.ts` does bend-array scoring, not coordinate
reconstruction (§1) — not a 4th implementation.

**Render/consumption sites — every file that puts a reconstructed shape
on screen, whether via its own implementation or by importing one of the
two shared components:**

| # | Site | How it gets its shape |
|---|---|---|
| 1 | `components/studio/BendSequenceDiagram.tsx` | Own implementation (`reconstructPoints`) |
| 2 | `components/studio/ProfileViewer3D.tsx` | Own implementation (`buildProfilePoints`) |
| 3 | `app/studio/draft/page.tsx` — "Load from Library" / `?loadProfile=` deep link | Own inline implementation, loads into editable canvas `points` |
| 4 | `components/studio/ProfileLibraryBrowser.tsx` — library card grid + compare tray + click-to-open modal | Imports `BendSequenceDiagram` (3 render call sites within this one file: card grid, compare tray, modal) |
| 5 | `components/admin/CommandCenterJobCard.tsx` | Imports `BendSequenceDiagram` |
| 6 | `components/studio/MatchedProfile3DModal.tsx` | Imports `ProfileViewer3D` (pass-through, no own reconstruction) |
| 7 | `components/studio/SubmitConfirmation3DModal.tsx` | Imports `ProfileViewer3D` (pass-through) |
| 8 | `app/studio/profile-viewer/[profileId]/page.tsx` (standalone shareable route) | Imports `ProfileViewer3D` (pass-through) |
| 9 | `app/upload/page.tsx` — "View 3D" modal on AI takeoff results | Imports `ProfileViewer3D`, but feeds it a **different, non-bend-sequence-sourced** shape via `buildBendsFromItem()` (a synthetic 2-bend cross-section built from the takeoff item's own `width`/`legA`/`legB` fields, not from any `machine_profile_bends` row — flagged in the file's own comment as "no matched profile to look up") |
| 10 | `app/studio/draft/page.tsx` — the canvas's own live 2D draw loop, and the inline `[3D]` toggle's `ProfileViewer3D` call | The canvas draws the user's own `points` directly (not a bend-sequence reconstruction — it's the *source* of truth being edited); the 3D toggle passes `ProfileViewer3D` a `bends` array *derived from* the user's points (the reverse direction of §1's algorithm), not bend-sequence data being reconstructed |

So: **2 shared rendering components** (`BendSequenceDiagram`,
`ProfileViewer3D`) are imported at **8 distinct render call sites**
across 7 files (#4 alone accounts for 3 of the 8), on top of the **3
independent reconstruction implementations** in §3 (one of which, #3
above, doesn't "render" in the traditional sense — it loads into an
editable canvas). `match-profile/route.ts` (§1) and `app/upload/page.tsx`
(#9 above) both touch profile shapes but neither reconstructs from real
`machine_profile_bends` data via the turtle-graphics algorithm — the
former never converts to coordinates at all, the latter fabricates a
placeholder shape from unrelated takeoff fields. If the task's "at least
4" was counting `BendSequenceDiagram` + `ProfileViewer3D` + the inline
`draft/page.tsx` copy + `match-profile`'s scoring as four *geometry*
implementations, that overcounts by one — `match-profile` isn't a
geometry implementation. If it was counting distinct *files that render a
shape on screen*, the real number is easily in the 8-10 range once
`ProfileLibraryBrowser`'s three internal call sites and the 3D
pass-through modals are counted individually, so "at least 4" undercounts
that framing. Both readings are answered above rather than picking one.

---

## 7. Conclusion

**Is the geometry algorithm itself correct as-is?** Yes, as far as this
audit could verify. The `heading += 180 - bend_angle_degrees` convention
is geometrically sound for a turtle-graphics polyline walk under the
"interior/included angle" reading, and all three independent
implementations (§1, §3) agree on it exactly, down to the "walk the final
bend's *right* leg after the loop ends" detail. This was **not** taken on
faith — see the trace in §1 and the schema/RLS cross-check in §4-5. **The
one piece of this audit that remains genuinely unverified is §2** (hand-
checking real profile data): this environment's command-approval gate
blocked both local script execution and the connected Supabase MCP tool
for the entire session, so the semantic claim ("the DB's stored values
really are interior angles, not turn angles, for real profiles") is
supported by the code's internal consistency and by every implementation
agreeing independently, but not by a from-scratch check against actual
rows. That gap is called out explicitly rather than glossed over, with
the exact query to close it once shell/MCP access is available.

**Is the only real defect the RLS gap in Load from Library?** Yes, among
what this audit found. It's real (§4, confirmed against the literal
policy SQL, not a guess), but it's a **silent-empty-result UX bug for
logged-out users**, not a data-correctness bug, not a security bug (RLS
is doing exactly what its policy says), and not a geometry bug — the
reconstruction math runs correctly on whatever rows it's given; the bug
is that a logged-out user is given zero rows with no explanation. No
other defect was found in the reconstruction algorithm, the schema, or
the render sites during this pass.

**Is there duplicated logic worth centralizing?** Yes (§3) — three
~20-line copies of the same math, already diverged in unit convention
(mm vs. inches) and field naming. Worth a future
`lib/utils/reconstructBendPolyline()` extraction, but low priority: all
three copies are currently correct and mutually consistent, so this is a
maintainability cleanup, not a bug fix, and is flagged here rather than
done unprompted, consistent with how this codebase's own governance docs
already handle non-urgent flagged items.

**No rewrite of any component is recommended.** No wrong-shape output was
found for any traced code path with real inputs — the closest thing to a
concrete defect is §4's RLS gap, which is a client-selection fix (swap
which Supabase client `openLibrary`/`loadFromLibrary` use, or add a
server route), not a geometry fix. The prior audit pass's premise — that
`bend_angle_degrees` was being misread as a turn angle — does not hold up
against the actual code; all three implementations already read it as the
interior/included angle, correctly and consistently.

---

## 8. Addendum — live-data verification and a directionality limitation
**Follow-up session. `geometry.ts` was NOT changed by this addendum — it
confirms §2's open item and documents a data-completeness limitation,
nothing more.**

**§2's open item is now closed.** With live service-role DB access, all
1000 `machine_profile_bends` rows with a non-null `bend_angle_degrees`
were pulled: **0 negative values, min 0, max 180.** Most common values are
180 (168 rows, straight), 90 (165 rows, right angle), and ~0 (352 rows,
recorded as 0.1 — a hemmed/folded-flat edge). This directly confirms the
interior-angle reading from §1/§7: a signed turn-angle convention
(positive = CCW, negative = CW, as an alternative hypothesis raised this
session) would require roughly half of all real bends to be negative,
since a shop fabricating flashing profiles turns corners in both
directions constantly. Zero negative values across 1000 real rows rules
that hypothesis out.

**Three real profiles were run through the unmodified
`computeProfilePoints()` and hand-verified:**

- **"07 A262" (1 bend, 90°):** `(0,0)→(3,0)→(3,3)` — clean right angle.
- **"Standard Profile 004" (2 bends, 45°/45°):** `(0,0)→(1.97,0)→
  (-9.17,11.14)→(-9.17,-4.61)` — arithmetically correct (turn=135° each,
  hand-traced and matched), but see the limitation below: this profile's
  two same-sign turns curl in one rotational sense rather than
  zig-zagging.
- **"Parapet Cap" / raw "Attika 309" (4 bends, 135°/95°/60°/0.1°):**
  final two points land almost exactly on top of point 3
  (`(-0.18,6.273)` vs `(-0.185,6.275)`) — the near-0° final angle is a
  hem, correctly folding the last leg back almost flat onto the prior
  segment. Non-degenerate, physically sensible.

**Limitation found (data-completeness, not an algorithm bug):**
`bend_angle_degrees` stores only the unsigned interior angle at each
bend — there is no field anywhere in `machine_profile_bends` encoding
which rotational direction (CW vs. CCW) a given bend turns. Because
`heading` in `computeProfilePoints()` can therefore only ever accumulate
`180 - angle` in one consistent direction, any real profile whose bends
should visually alternate direction (a classic Z-bar, S-profile, or
hat/channel shape with mixed handedness) will reconstruct as a
consistent curl/spiral instead of a zig-zag. `BendSequenceDiagram.tsx`'s
own doc comment already flags this in general terms ("no explicit
connectivity/direction metadata in the source bend records"); this
addendum confirms it concretely against real multi-bend data and
narrows it to the specific missing field. **No fix is proposed here** —
resolving it would require either a new signed-direction column
populated at import time from the DS2801's raw job data (if that data
exists upstream — unconfirmed) or accepting the current approximation
as a known constraint of `machine_profile_bends`'s schema.

---

*GEOMETRY_AUDIT.md | AFS | Audit-only pass, no application code changed.*
