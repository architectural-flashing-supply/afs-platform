# CREDIT_APP_GAPS.md
## AFS — Online Credit Application: Real Paper Form vs. Live Build

Prepared by reading `specs/SPEC_ONLINE_CREDIT_APPLICATION.md`,
`app/account/credit-application/page.tsx`,
`components/account/CreditApplicationForm.tsx`,
`app/api/credit/apply/route.ts`, `lib/data/credit.ts`, the
`credit_applications` table (`SCHEMA.md` / `001_initial_schema.sql:928-957`),
the admin review surface (`app/admin/credit-applications/page.tsx`,
`components/admin/CreditApplicationReviewModal.tsx`,
`app/api/admin/credit-applications/[id]/route.ts`), and
`PO_INTEGRATION_SCOPE.md` — against the real AFS fillable-PDF credit
application's five sections, field by field.

**Bottom line up front:** the live form is a plausible-looking generic
"credit app" invented from the spec's TypeScript interface — it was never
built against the actual paper form. It captures a different, smaller,
partially-overlapping set of facts than the real document, is missing two
entire sections outright (business/bank address info and the real legal
agreement text), and only collects 4 of the real form's 7 trade-reference
fields. No schema migration is needed to fix this — `application_data` is
JSONB and already accommodates every field below — but the form, the API
input type, and the admin review display all need rebuilding to match.

---

## SECTION 1 — Business Contact Information

| Real form field | Current implementation | Verdict |
|---|---|---|
| Purchase Order required? (Yes/No) | Not collected anywhere — no field in `CreditApplicationForm.tsx`, no key in the API body, no column | **Missing entirely** |
| Company name | `legalBusinessName` (`CreditApplicationForm.tsx:53`, step 1) | Collected, different name only |
| Phone | Not collected | **Missing entirely** |
| Fax | Not collected | **Missing entirely** |
| Email | Not collected (only the logged-in user's account email exists via auth, never captured as a company contact email on the application itself) | **Missing entirely** |
| Registered company address | Not collected | **Missing entirely** |
| City/State/ZIP | Not collected | **Missing entirely** |
| Date business commenced | `yearsInBusiness: number` (`CreditApplicationForm.tsx:56`, `route.ts:19`) | **Different data** — an approximate duration, not the actual commencement date the real form asks for |
| Business type | `businessType`: `corporation \| llc \| partnership \| sole_proprietor` (`CreditApplicationForm.tsx:6, 21-26`) | **Different enum** — real form is `Sole proprietorship / Partnership / Corporation / Other`; current build has `llc` where the real form has an open `Other`, and has no `Other` catch-all at all |

Section 1 is roughly 2 of 9 real fields collected, and one of those two
(business type) uses the wrong option set.

---

## SECTION 2 — Business and Credit Information

| Real form field | Current implementation | Verdict |
|---|---|---|
| Primary business address, City/State/ZIP | Not collected | **Missing entirely** |
| How long at current address | Not collected | **Missing entirely** |
| Telephone | Not collected | **Missing entirely** |
| Fax | Not collected | **Missing entirely** |
| Email | Not collected | **Missing entirely** |
| Bank name | Not collected | **Missing entirely** |
| Bank address | Not collected | **Missing entirely** |
| Bank phone | Not collected | **Missing entirely** |
| Bank City/State/ZIP | Not collected | **Missing entirely** |
| Savings / Checking / Other account-number table (3 rows) | Not collected | **Missing entirely** |

**Section 2 does not exist in the current build at all** — zero of its ten
fields are collected anywhere in `CreditApplicationForm.tsx`, the API
route, or the schema. Nothing today asks for a bank reference of any kind,
which is a real gap since the Agreement text (Section 4) explicitly
authorizes AFS to inquire with "the supplied banking ... references" —
today there's no banking reference to inquire about.

Conversely, the current form collects two fields that **aren't on the real
form's Section 1/2 at all**: `taxId` (EIN) and `annualRevenue`. These may
exist elsewhere on the real PDF outside the five sections described, but
as scoped here they're extra fields invented for the digital version, not
verified against the real document. Flag for the business owner to confirm
whether EIN/revenue banding should stay, move, or be dropped.

---

## SECTION 3 — Business/Trade References

Real form: **3 full reference blocks**, each with Company name, Address,
City/State/ZIP, Phone, Fax, Email, Type of account (7 fields × 3 = 21
data points).

Current (`CreditApplicationForm.tsx:10-15`, `TradeReferenceForm`):
```ts
interface TradeReferenceForm {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
}
```

| Real field | Current | Verdict |
|---|---|---|
| Company name | `businessName` | Collected |
| Address | — | **Missing** |
| City/State/ZIP | — | **Missing** |
| Phone | `phone` | Collected |
| Fax | — | **Missing** |
| Email | `email` (optional in current UI — real form doesn't mark it optional) | Collected, but wrongly optional |
| Type of account | — | **Missing** |
| *(no equivalent — not on real form)* | `contactName` | Extra field not on the real form |

Structurally correct (3 required, "add more" supported at
`CreditApplicationForm.tsx:81-87`, min-3 enforced both client-side
(`:100`) and server-side (`isValidReference` / length check,
`route.ts:35-46, 79-82`) — that validation logic is reusable, it just needs
to validate the right shape. Currently collects 3 of 7 fields per reference
(43%), plus one non-real field.

---

## SECTION 4 — Agreement

Real form: exact terms text — net-30 payment terms, 1.5% monthly late
charge, customer responsible for lien filing/collection/attorney fees,
claims must be made within 7 working days, submission authorizes AFS to
inquire with the supplied banking/trade references.

Current (`CreditApplicationForm.tsx:483-493`):
```
I certify that the information provided in this application is true and
accurate, and I authorize AFS to verify this information and the trade
references listed.
```

**Verdict: present but substantively wrong.** This is a generic
certification checkbox, not the real agreement. None of the actual
contractual terms appear anywhere in the app: no net-30 statement, no
1.5%/month late charge, no lien-filing/collection/attorney-fees
responsibility clause, no 7-working-day claims window, and the
bank-reference-inquiry authorization can't be accurate today since no bank
reference is even collected (Section 2). `certificationAccepted: boolean`
(`route.ts:94-96`) is stored as a bare flag with no record of *which* terms
text the customer agreed to — if AFS ever needs to prove what was agreed
to, the current record doesn't capture it. The real terms text should be
rendered in full (or linked/expandable) above the checkbox, and — since
that text is legally load-bearing — the version of it in effect at
signing should probably be stored alongside `certificationAccepted`
(e.g. a `termsVersion` or the literal terms text snapshotted into
`application_data`), not just a boolean.

---

## SECTION 5 — Signatures

Real form: **two signature blocks**, each with Title and Date.

Current (`CreditApplicationForm.tsx:71-75`, `route.ts:108-111`):
```ts
authorizedName: string;
authorizedTitle: string;
signatureTyped: string;
signedAt: string; // server-set, new Date().toISOString()
```

One signature block only. **Missing the second signature block entirely**
— both the second signer's name/title/typed-signature and the fact that
the real form calls for two independent dated signatures, not one.

---

## SCHEMA CHECK — `credit_applications`

```sql
CREATE TABLE credit_applications (
  id, user_id, company_id, status,
  application_data JSONB NOT NULL,   -- <-- everything below lives here
  requested_limit, requested_terms,
  approved_limit, approved_terms,
  reviewer_id, reviewer_notes,
  submitted_at, reviewed_at
);
```

**No migration is needed.** `application_data` is an untyped JSONB blob —
it already has room for the address fields, the bank-account table, the
expanded trade-reference objects, the PO-required flag, and a second
signature block; none of those need their own columns. The task's
hypothesis that trade references and bank fields would force a schema
change doesn't hold up against the actual table definition — this is a
TypeScript-interface, form-UI, and validation problem, not a database
problem.

The one column-level thing worth flagging: `status` is
`CHECK (status IN ('submitted','under_review','approved','denied'))` and
nothing in the app ever transitions a row into `'under_review'` — every
row goes straight from `'submitted'` to `'approved'`/`'denied'`. Not a gap
introduced by this task, and not required to fix the field-coverage
problem above, but worth a one-line mention since the admin list page
(`app/admin/credit-applications/page.tsx:15-20`) already renders a badge
for a status value nothing ever sets.

---

## THE require_po QUESTION

**Recommendation: yes, in principle the credit application should be the
mechanism that sets `companies.require_po` on approval — but wiring it in
this pass is larger than it looks, because the entire approval→company
write pipeline the spec calls for doesn't exist yet at all.**

Reasoning:

1. **Conceptually this is the right source of truth.** Section 1's
   "Purchase Order required?" is the customer stating, in their own
   words, the same fact `companies.require_po` exists to encode. Asking
   the admin to separately toggle it later (`PO_INTEGRATION_SCOPE.md`'s
   planned `CompanyPoRequirementForm` on `/admin/customers/[id]`) when the
   answer was already given on this form is redundant data entry and an
   obvious drift risk — two places can disagree about the same fact.

2. **But the approval endpoint doesn't write to `companies` (or
   `profiles`) at all today**, despite the spec's own §3 saying it
   should: `app/api/admin/credit-applications/[id]/route.ts:62-77` only
   ever updates the `credit_applications` row itself
   (`status`/`reviewer_id`/`reviewer_notes`/`reviewed_at`/`approved_limit`/
   `approved_terms`). It never sets `profiles.net_terms`,
   `companies.credit_limit`, or `pricing_tier` — the three fields
   `SPEC_ONLINE_CREDIT_APPLICATION.md:62` explicitly says approval should
   set. This is a pre-existing gap independent of the paper-form
   comparison, but it's directly relevant here: there is no
   approval-writes-to-company pipeline to "also" add `require_po` to —
   that pipeline has to be built from scratch either way.

3. **`company_id` can be null at application time.** The insert route
   already resolves and stores `profile?.company_id` on submission
   (`app/api/credit/apply/route.ts:98,119`), but per
   `PO_INTEGRATION_SCOPE.md` §3c, a customer who never went through Team
   Accounts has no `companies` row to attach anything to. If
   `credit_applications.company_id IS NULL` at approval time, there is
   nowhere to write `require_po` (or `credit_limit`/`net_terms`) yet — the
   stated answer would need to sit in `application_data` until a company
   row exists, with the admin applying it manually later via the
   `CompanyPoRequirementForm` po-002 already plans to build.

**What this means for scope:** since fixing the approval flow to actually
set `profiles.net_terms` / `companies.credit_limit` / `pricing_tier` is
already implied — the current code silently doesn't do what its own spec
says — folding `require_po` into that same write (when `company_id` is
resolvable) is marginal additional work on a pipeline this pass has to
build regardless, not a second, separate feature. It is **not** a
substitute for `po-002`'s manual `CompanyPoRequirementForm`: that toggle
still needs to exist, both as the correction path and as the only path
for companies with no credit application on file at all (or one submitted
before this field existed). Recommend building both, in this order:
add the field and collect it (this pass), then have approval set it
alongside the other company-level fields it should already be setting.

If the business owner wants to keep this pass strictly scoped to
field-collection and defer *all* write-on-approval behavior (including the
pre-existing net_terms/credit_limit/pricing_tier gap) to a separate pass,
that's a reasonable call too — but it should be an explicit decision, not
a default, since the gap was found live in the code, not assumed.

---

## WHAT `credit-app-002` SHOULD BUILD

No migration. All changes are in the form component, the API route's
input type/validation, the admin review UI, and (per the section above)
the approval PATCH handler.

1. **Rebuild `CreditApplicationForm.tsx`'s data model** to match the real
   five sections:
   - Section 1: add `poRequired: boolean`, `phone`, `fax` (optional),
     `email`, `registeredAddress` (street/city/state/zip), replace
     `yearsInBusiness` with `dateCommenced` (or keep both if the owner
     wants the approximation retained for internal use), and fix
     `businessType` to `'sole_proprietorship' | 'partnership' |
     'corporation' | 'other'` (drop `llc`, add `other`).
   - Section 2 (currently absent — add as a new step): primary business
     address + city/state/zip, time at address, telephone, fax, email,
     bank name/address/phone/city/state/zip, and a 3-row
     savings/checking/other account-number table.
   - Section 3: extend `TradeReferenceForm` with `address`,
     `cityStateZip`, `fax`, `accountType`; make `email` required to match
     the real form; keep `businessName`/`phone`; drop or relabel
     `contactName` per the owner's call since it isn't on the real form.
   - Section 4: replace the generic certification copy with the real
     agreement text in full (net-30 terms, 1.5%/month late charge, lien/
     collection/attorney-fees clause, 7-working-day claims window, bank +
     trade reference inquiry authorization), and persist a snapshot of
     that text (or a version tag) alongside `certificationAccepted` in
     `application_data`.
   - Section 5: add a second signature block (name, title, typed
     signature, date) alongside the existing one.
2. **Update `app/api/credit/apply/route.ts`**: extend `CreditApplyBody`
   and its validation for every new field above (all stored inside the
   existing `application_data` JSONB — no new columns).
3. **Update the admin side** (`CreditApplicationReviewModal.tsx`,
   `lib/data/credit.ts`'s `CreditApplicationRow`/`getCreditApplications`)
   to actually display the fuller `application_data` payload (addresses,
   bank info, all reference fields, both signatures) instead of just
   company name / requested limit / terms — right now an admin reviewing
   an application can't see most of what the customer submitted even
   after this form collects it.
4. **Fix the approval write-back** (`app/api/admin/credit-applications/
   [id]/route.ts`): on `status === 'approved'`, also set
   `profiles.net_terms` and, when `company_id` is present,
   `companies.credit_limit` and `companies.require_po` (sourced from the
   applicant's Section 1 answer, admin-overridable in the review modal
   before confirming). When `company_id` is null, skip the company write
   and surface a note in the modal ("No company on file — PO requirement
   and credit limit must be set manually once this customer has a
   company"), matching the pattern `PO_INTEGRATION_SCOPE.md` §3c already
   established for the same edge case.
5. **Do not build in this pass:**
   - Any change to `credit_applications`' columns — `application_data`
     already covers everything.
   - `PO_INTEGRATION_SCOPE.md`'s `CompanyPoRequirementForm` manual toggle
     itself — that's `po-002`'s own deliverable; this pass only makes
     credit-app approval populate the same field, it doesn't replace the
     manual control.
   - A `status = 'under_review'` transition UI — noted as a loose end
     above but unrelated to the paper-form field gap and not requested.

---

*CREDIT_APP_GAPS.md | AFS | prepared from a live codebase audit against the real paper credit application, 2026-07-31*
