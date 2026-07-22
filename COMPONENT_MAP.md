# COMPONENT_MAP.md
## AFS — Complete Component Map
**Every component by section. Used by FORGE to know what exists before creating new files.**

---

## LAYER 1 — UI PRIMITIVES (`components/ui/`)

**Six files exist here — updated 2026-07-15 (afs-ui-001), which added
Button.tsx/Modal.tsx/Toast.tsx/Input.tsx on top of the two that already
existed (Badge.tsx/EmptyState.tsx, confirmed 2026-07-14 by afs-041).**
This layer was originally specced with ~20 shared atomic primitives
(Button, Card, Input, DataInput, Select, Textarea, Checkbox,
RadioGroup/RadioCard, Spinner, Tooltip, Modal, Toast, Table, Pagination,
Tabs/Tab, Accordion/AccordionItem, ConfirmModal, FileTypeIcon) — as of
afs-ui-001, 4 of those ~20 are real; the remaining ~16 (Card, DataInput,
Select, Textarea, Checkbox, RadioGroup/RadioCard, Spinner, Tooltip,
Table, Pagination, Tabs/Tab, Accordion/AccordionItem, ConfirmModal,
FileTypeIcon) are still unbuilt. Every existing page in this codebase
still hand-rolls its own Tailwind buttons/inputs/modals/tables inline
rather than importing from this layer — afs-ui-001 built the four new
primitives but deliberately did NOT migrate any existing page to use
them (that migration is scoped as a separate, later prompt). Reusable
atomic components. No business logic. No data fetching.

```
Button.tsx (NEW, afs-ui-001)
  Props: variant ('primary'|'secondary'|'danger', default 'primary')
         size ('sm'|'md', default 'md')
         children (React.ReactNode)
         ...rest (native <button> attributes — onClick, disabled, type,
         aria-*, etc.)
  variant classes mirror the site's existing hand-rolled buttons exactly:
  primary → bg-afs-crimson hover:bg-afs-crimson-hover text-white (the
  crimson-primary convention used everywhere from app/quote/page.tsx's
  step buttons to app/checkout/page.tsx's Place Order button);
  secondary → border border-afs-border bg-afs-bg-overlay
  text-afs-chrome-high hover:bg-afs-bg-surface (the bordered "Cancel" /
  "Submit Another" convention, e.g. ProfileDetailsModal.tsx's Cancel
  button); danger → border-2 border-afs-crimson bg-transparent
  text-afs-crimson hover:bg-afs-crimson hover:text-white — an outlined
  treatment, not a literal copy of any single existing button, since no
  hand-rolled instance in this codebase currently needs a primary and a
  destructive-confirm button rendered together (CommandCenterJobCard.tsx's
  "Reject Job" confirm reuses the same solid crimson as its own primary
  action) — a shared Button needs the two to read as visually distinct
  when they DO appear together, so this variant was designed rather than
  copied; flagged here in case a future session wants to reconcile it
  against a specific existing destructive-button instance instead. All
  variants: font-label font-semibold rounded transition-colors
  disabled:opacity-50 disabled:pointer-events-none, defaults to
  type="button" (overridable via props, so type="submit" still works).

Modal.tsx (NEW, afs-ui-001)
  Props: isOpen (boolean) | onClose (() => void) | title? (string) |
         children (React.ReactNode) | footer? (React.ReactNode) |
         maxWidthClass? (string, default 'max-w-md')
  Matches the two existing hand-rolled modal implementations exactly
  (components/studio/ProfileDetailsModal.tsx,
  components/admin/CommandCenterJobCard.tsx's inline reject/request-
  changes modal): fixed inset-0 bg-black/60 flex items-center
  justify-center z-[60] px-6 backdrop (onClick closes), inner panel
  bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6
  w-full {maxWidthClass} with a stopPropagation click handler so clicking
  the panel itself doesn't close it. title renders as
  font-heading text-xl text-afs-chrome-high mb-4 when provided; footer
  renders as a flex gap-3 justify-end mt-6 row when provided (both
  existing modals put their Cancel/Confirm buttons in exactly this
  layout). Added Escape-to-close (neither existing hand-rolled modal has
  this; a small, low-risk addition standard for a shared modal
  primitive, not present in either source it was modeled on).

Toast.tsx (NEW, afs-ui-001)
  Props: message (string | null) | variant? ('success'|'error'|'info',
         default 'success') | duration? (number ms, default 3000) |
         onDismiss (() => void)
  Matches app/studio/draft/page.tsx's existing local toast exactly (the
  one afs-040's build notes flagged as having "no shared Toast.tsx
  component to reuse"): fixed bottom-6 right-6 z-[70] bg-afs-bg-raised
  border rounded px-4 py-3 shadow-raised, font-body text-sm
  text-afs-chrome-high message text. FlashDraft's original only ever
  used a green border (afs-accent-green, its save-success case); this
  component generalizes that into a variant prop (success→
  afs-accent-green, error→afs-crimson, info→afs-info) so error/info
  toasts elsewhere don't have to invent their own border color. Unlike
  FlashDraft's original (where the parent owns a raw setTimeout to clear
  its toast string), this component owns the auto-dismiss timer itself
  (starts/resets whenever `message` changes, calls `onDismiss` after
  `duration`) so callers don't each reimplement the same setTimeout.
  Renders null when `message` is null.

Input.tsx (NEW, afs-ui-001)
  Props: label? (string) | error? (string) | ...rest (native <input>
         attributes — type, value, onChange, placeholder, disabled,
         required, min, max, step, etc.) | forwards a ref
  Matches the `inputClass`/`labelClass` constants already duplicated
  across app/quote/page.tsx, app/checkout/page.tsx, and
  ProfileDetailsModal.tsx: label (when provided) renders font-label
  text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block; the
  input itself is w-full bg-afs-bg-overlay border rounded px-3 py-2.5
  font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim
  focus:outline-none focus:border-afs-crimson transition-colors
  disabled:opacity-50 disabled:pointer-events-none, with the border
  color switching from afs-border to afs-crimson when `error` is set;
  the error message (when provided) renders font-body text-xs
  text-afs-crimson mt-1 below the input, matching
  ProfileDetailsModal.tsx's nameError paragraph exactly. Does not
  wrap <textarea> or <select> — every existing hand-rolled instance of
  those uses a distinct multi-line/dropdown layout this component
  doesn't attempt to generalize.

Badge.tsx
  Props: variant ('success'|'warning'|'error'|'chrome'|'info')
         children (React.ReactNode)
         pulse (boolean, default false — adds animate-pulse to the dot)
         size ('sm'|'md', default 'sm')
  Renders a pill: a small colored dot + text, border border-afs-chrome-dim.
  Text/dot color per variant: success→afs-success, warning→afs-warning,
  error→afs-crimson, chrome→afs-chrome-base/mid, info→afs-info.
  Note: does NOT have 'crimson' or 'copper' variants — a stale earlier
  version of this doc claimed 7 variants; the real file has 5.

EmptyState.tsx
  Props: title (string) | description (string) | actionLabel? (string) |
         actionHref? (string) | secondaryLabel? (string) |
         secondaryHref? (string) | accent? ('crimson'|'copper', default
         'crimson')
  Centered card (bg-afs-bg-raised border rounded p-12): heading +
  description, then up to two CTA links — a primary filled button
  (actionLabel/actionHref, colored by `accent`) and a secondary bordered
  ghost button (secondaryLabel/secondaryHref). Both link pairs are
  optional; renders no button row if neither is provided.
  Note: does NOT take an `icon` prop — a stale earlier version of this doc
  claimed one; the real file has no icon slot.
```

If a future session builds any of the remaining ~16 previously-specced
primitives above, add them here individually as they're actually
created — don't restore the old speculative list wholesale, since most
of those component designs (variant names, styling details) were never
validated against a real build either. Button.tsx/Modal.tsx/Toast.tsx/
Input.tsx (afs-ui-001, added above) are the precedent for how to do this
correctly: each entry documents which real, already-on-screen hand-rolled
pattern the new primitive was matched against, not an assumed design.

---

## LAYER 2 — LAYOUT (`components/layout/`)

```
AppChrome.tsx
  Client component wrapping every route from the root app/layout.tsx.
  Decides which global chrome a route gets — the ONLY place this
  decision is made; individual layout.tsx files never import NavBar.
  NO_CHROME_PREFIXES (/login, /register, /forgot-password,
  /reset-password, /invite) → bare {children}, no chrome at all.
  PORTAL_PREFIXES (/admin, /account) → bare {children} — no NavBar, no
  Footer, no ChatWidget — since AdminShell/AccountShell already supply a
  complete sidebar + content shell. Everything else → <NavBar/> +
  <div className="ml-48 pt-11">{children}<Footer/></div> + <ChatWidget/>.
  See ARCHITECTURE.md's "AppChrome Portal Exclusion Pattern" for the full
  pattern and the afs-036 double-nav bug this fixed.

NavBar.tsx
  NOT a single top bar — an L-shaped chrome rendered as two fixed elements:
    Left rail: fixed top-0 left-0 bottom-0 w-48 (192px), bg-afs-bg-dim,
      logo, then a vertical link list (Home, Products, Request a Quote,
      Configure, Upload Drawing, Design Studio, Architects, My Account/
      Sign In, Sign Out if authenticated), "Est. Texas" footer line.
    Top header: fixed top-0 left-48 right-0 h-11 (44px), bg-afs-bg-raised,
      horizontal desktop-only (md:flex) link row duplicating the same 6
      content links (Products through Architects).
  Only rendered by AppChrome for non-portal, non-auth routes — see
  AppChrome.tsx above. The ml-48 pt-11 wrapper AppChrome applies to
  {children} exists specifically to clear this rail+header combination.

Footer.tsx
  bg-afs-bg-raised border-t border-[var(--afs-border)]
  Max-width 1280px, px-6 gutters, py-16
  4 columns: Brand | Products | Resources | Company
  Bottom bar: copyright, Privacy, Terms
  All text: text-afs-chrome-dim text-sm
  Column headings: font-label font-semibold text-afs-chrome-mid text-sm tracking-wider uppercase
  Rendered by AppChrome only on non-portal, non-auth routes.

PageShell.tsx
  max-w-[1280px] mx-auto px-6
  Used to constrain all page content

NarrowShell.tsx
  max-w-[860px] mx-auto px-6
  Used for forms, upload pages, quote wizard

SectionDivider.tsx
  Metal Edge applied as a full-width horizontal rule
  1px with chrome gradient at 12° skew

AdminShell.tsx
  Two-panel: <aside> sidebar (240px fixed) + <main> content (flex-1)
  Sidebar: fixed top-0 left-0 bottom-0 w-[240px] (positioned from the true
    viewport edge — AppChrome renders no public NavBar on /admin/** to
    clear, see AppChrome.tsx above), bg-afs-bg-raised border-r
    border-afs-border, logo, then nav sections (Operations: Command
    Center w/ live pending-job-count badge, Quote Requests, Production
    Queue, Consultations; Business: Customers, Credit Apps, Pricing;
    Content: CAD Library; Integrations: QuickBooks; Settings: Settings),
    admin name + Sign Out button pinned to the bottom.
  Active nav item: border-l-2 border-afs-crimson bg-afs-bg-surface text-white
  main: flex-1 ml-[240px] pt-16 px-8 pb-16

AccountShell.tsx
  Same two-panel pattern as AdminShell.tsx, aside width 220px, positioned
  fixed top-0 left-0 bottom-0 (same reasoning — no public NavBar to
  clear on /account/**).
  Links: Dashboard | My Orders | My Quotes | My Projects | Documents |
  Invoices | Templates | Team | Credit Application | Settings
  Sign Out button pinned to the bottom, same hard-redirect pattern as
  AdminShell (supabase.auth.signOut() then window.location.href = '/login').

ArchitectShell.tsx
  Extends PageShell with copper accent treatment
  Used on all /architects/** pages
  Copper eyebrow label pattern above headings
```

---

## LAYER 3 — HOMEPAGE (`components/home/`)

```
HeroSection.tsx
  Full viewport, two-column (60/40) desktop, stacked mobile
  Left: eyebrow + H1 (Bebas Neue 7rem) + subheadline + CTA group
  Right: HeroVisual.tsx (animated CSS mockup — no external assets)

HeroVisual.tsx
  Animated mockup of upload interface / takeoff results
  Pure CSS — no images, no video, no external dependencies
  Shows simplified TakeoffResultsTable preview
  Items animate in with staggered fade-up

TrustBar.tsx
  Full-width band, separator-divided trust signals
  "SMACNA Standards Compliant | Custom Fabrication In-House | Ships Nationwide | AI-Powered Quoting"

ThreePillarsSection.tsx
  Three PillarCard.tsx in a row

PillarCard.tsx
  Props: icon | heading | body | ctaText | ctaHref | accentColor ('crimson'|'copper')

AIQuoteTeaser.tsx
  Two-column: left text + feature list, right ProcessingStatusPanel mockup (static CSS)

HowItWorksSection.tsx
  Four HowItWorksStep.tsx components with connector lines

HowItWorksStep.tsx
  Props: number | icon | title | body | isLast

StatSection.tsx
  Three StatBlock.tsx — "48HR", "2MIN", "50+"

StatBlock.tsx
  Props: value | label
  value: font-display text-8xl text-afs-chrome-high

ProductCategoryGrid.tsx
  3×2 grid of CategoryCard.tsx

CategoryCard.tsx
  CSS gradient placeholder until photography received
  Profile name in Bebas Neue, crimson arrow icon
  Link to /products/[category-slug]

ArchitectCTASection.tsx
  Full-width with copper left border accent
  Targets architect audience specifically

ProjectGallery.tsx
  Masonry-style image grid
  CSS gradient placeholders until photography received

TestimonialsSection.tsx
  Three TestimonialCard.tsx

TestimonialCard.tsx
  Props: quote | attribution

FinalCTASection.tsx
  bg-afs-crimson full-width
  Two CTAs: white bg crimson text | white border white text
```

---

## LAYER 4 — UPLOAD + DRAWING TOOL (`components/upload/`, `components/drawing/`)

```
UploadDropzone.tsx
  Full drag-and-drop zone, min 480px height
  Accepts: .dwg .dxf .pdf .png .jpg .jpeg .tiff .webp
  Drag-over: border-afs-crimson bg-afs-crimson-ghost
  Client-side validation before upload

UploadProgress.tsx
  Crimson progress bar with smooth animation
  Filename, file size, cancel button (AbortController)

ProcessingStatusPanel.tsx
  Four-step stage indicator (not a spinner)
  Stages: reading → identifying → calculating → building
  Current stage pulses, completed stages show crimson checkmark

TakeoffResultsTable.tsx
  Fully editable results table
  Columns: # | Profile | Material | Gauge | W×H×A×B | Length | Qty | Unit | Confidence | Actions
  Profile: dropdown from product_profiles table (not hardcoded)
  Material: dropdown from materials table
  Confidence: green/amber/crimson badge
  Low confidence rows: amber left border
  Add row, remove row, duplicate row

TakeoffActions.tsx
  Primary: "Submit Quote Request" (crimson)
  Secondary: "Save for Later" (ghost, auth only)
  Ghost: "Start Over"
  Ghost: "Talk to an Estimator" → /architects/consultation

ExtractionFailurePanel.tsx
  Three recovery options:
  "Try Different File" | "Build Quote Manually" → /quote | "Talk to Estimator"

GuestCaptureModal.tsx
  Email input before submission for unauthenticated users

PhotoUploadZone.tsx
  Photo-to-quote variant — large touch targets, camera icon prominent
  Mobile-first layout

PhotoGrid.tsx
  Thumbnails of uploaded photos with per-photo processing status

DocumentUploader.tsx
  Multi-context upload: 'vault' | 'cad-library' | 'order-attachment'
  Configured by context prop
  Multi-file, parallel upload, per-file progress

DocumentList.tsx
  contextType | contextId | allowDelete | allowDownload | viewMode ('grid'|'list')

DocumentPreviewModal.tsx
  PDF: iframe embed
  Images: full-size with zoom
  CAD/RVT: "Download to view" message
```

---

## LAYER 5 — QUOTE REQUEST (`components/quote/`)

```
QuoteWizard.tsx
  Orchestrates 4-step wizard
  Manages QuoteRequestSession state
  Persists to localStorage

QuoteStep1Profiles.tsx
  ProfileTypeSelector grid from product_profiles table

QuoteStep2Material.tsx
  MaterialSelector + GaugeSelector + FinishSelector
  All populated from Supabase, not hardcoded

QuoteStep3Dimensions.tsx
  Dynamic dimension inputs per profile type
  ProfileDiagramSVG updates live (debounced 150ms)
  Waste factor display (quantity only — no price)

QuoteStep4Review.tsx
  Read-only summary table
  No price column
  Rush flag if set
  "Submit Quote Request" button
  GuestEmailCapture if not authenticated

QuoteRequestSummaryTable.tsx
  Columns: Profile | Material | Gauge | Dimensions | Length | Qty | Unit
  No price. No total.

ProfileTypeSelector.tsx
  Grid of ProfileTypeCard.tsx
  requiresConsultation profiles redirect to ConsultationRedirectModal

ProfileTypeCard.tsx
  Profile SVG thumbnail, name, short description
  Selected: border-afs-crimson

MaterialSelector.tsx
  Radio card grid filtered by profile compatibility

GaugeSelector.tsx
  Chip group filtered by selected material

FinishSelector.tsx
  Color chip grid (hex_preview as background)
  Selected: ring-2 ring-afs-crimson

DimensionInput.tsx
  type="number" step="0.125" font-data
  Suffix: " (inches)
  Min/max validation from product_profiles

ProfileDiagramSVG.tsx
  Parameterized SVG per profile type
  Updates live from dimension inputs
  Dimension labels in crimson

AutoMaterialCalculator.tsx
  Quantity math only — no prices
  Shows: raw qty, waste factor, adjusted qty, recommended accessories

ConsultationRedirectModal.tsx
  Shown when requiresConsultation profile selected
  "This profile requires our engineering team"
  CTA: "Schedule a Consultation"

MultiItemBar.tsx
  Shows count of items in current request
  "Add Another Profile" button
```

---

## LAYER 6 — FLASHING CONFIGURATOR (`components/configurator/`)

```
ConfiguratorShell.tsx
  Two-panel desktop, tabbed mobile
  Left: ConfiguratorControls (480px)
  Right: ConfiguratorPreview (flex-1)

ConfiguratorControls.tsx
  Sections: Profile | Material | Gauge | Finish | Dimensions | Length+Qty | Notes
  "Submit for Quote" primary button
  "Save Configuration" link (auth)
  "Add to Quote Request" link

ConfiguratorPreview.tsx
  ProfileDiagramSVG (live)
  SpecSummaryPanel (text summary, font-data)
  Disclaimer: "Estimated CAD preview — for reference only"
  No price display

SavedConfigCard.tsx
  Used in /architects/custom-profiles
  Left: ProfileDiagramSVG scaled
  Right: profile details, dimensions (font-data), reorder/edit buttons
```

---

## LAYER 7 — PRODUCT CATALOG (`components/product/`)

```
ProductCatalogPage.tsx
  Two-column: ProductFilterPanel + ProductGrid

ProductFilterPanel.tsx
  Collapsible accordions: Profile Type | Material | Gauge | Finish | Availability
  URL param driven — filters shareable
  Mobile: drawer with filter count badge
  "Clear all" when filters active

ProductCard.tsx
  No price. No "From $X" anywhere.
  Category badge, SKU (if exists), name (font-heading), material + gauge
  Stock badge: "In Stock" | "Made to Order" | "Special Order"
  CTA: "Request a Quote" | "Configure"

ProductDetailPage.tsx
  Two-column: ProfileDiagramSVG + ProductDetailInfo
  No price display
  MaterialOptions | GaugeSelector | FinishSelector | DimensionReference
  CTA primary: "Request a Quote for This Product"
  CTA secondary: "Configure Custom Dimensions"
  Tabs: Overview | Specifications | Installation | Documents

GaugeSelector.tsx (shared with quote components)

FinishSelector.tsx (shared with quote components)
```

---

## LAYER 8 — CUSTOMER ACCOUNT (`components/account/`)

```
DashboardPage.tsx
  WelcomeHeader, ActiveOrdersCard, RecentQuotesCard,
  UpcomingDeliveryCard, QuickActionsCard

ActiveOrdersCard.tsx
  Orders with status NOT IN (delivered, cancelled)
  Max 3 shown, "View all" link

RecentQuotesCard.tsx
  quote_requests and formal quotes from AFS
  Status badge per item

ProductionTimeline.tsx
  Vertical stage-by-stage timeline
  Completed: filled crimson dot
  Active: pulsing crimson dot
  Pending: empty chrome-dim dot, dashed connector
  Shop photo between qc and ready stages
  Tracking link when shipped

OrderDetailPage.tsx
  OrderDetailHeader, OrderLineItemsTable (read-only), ProductionTimeline,
  OrderAttachments, DeliverySection, PaymentSection, ReorderSection

QuoteDetailPage.tsx (/account/quotes/[id])
  First place customer sees prices
  AFS-set line items with unit price and line total
  Subtotal, freight, rush surcharge, total
  Estimator notes
  [Approve & Pay] → /checkout?quote={id}
  [Request Revision] → RevisionRequestModal
  [Download Quote PDF]

DeliveryScheduler.tsx
  Month calendar (not a date picker input)
  Window selector: Morning | Afternoon | All Day
  Special instructions textarea

InvoicePortal.tsx
  Paginated table: Invoice # | Order # | Date | Amount | Status | Actions
  Status: paid | due | overdue
  Download PDF button per invoice

MultiProjectPage.tsx
  ProjectCard grid with CreateProjectModal

ProjectDetailPage.tsx
  Tabs: Orders | Quotes | Documents | Team

VaultDocumentList.tsx
  Uses DocumentList.tsx (from upload layer)
  Folder-based organization

TeamManagementPage.tsx
  Member table: Name | Email | Role | Status | Actions
  InvitationModal

QuoteTemplateList.tsx
  Template cards with use count
  "Use Template" → loads items into quote wizard
```

---

## LAYER 9 — ARCHITECT PORTAL (`components/architects/`)

```
ArchitectHero.tsx
  Copper accent variant of standard hero
  "The Architect's Platform" H1 in Bebas Neue

PortalFeatureGrid.tsx
  Four PortalFeatureCard.tsx (spec writer, CAD, finish, profiles)

AISpecWriter.tsx
  Multi-step spec generation flow
  Step 1: CSI section selection
  Step 2: Profile + material selection
  Step 3: Project context (optional)
  Step 4: Generate button → SpecPreview

SpecPreview.tsx
  Renders structured CSI spec with Part 1/2/3 sections
  Inline editing capability
  Download DOCX button

CADLibraryPage.tsx
  LibraryFilters (profile type, format, material)
  CADFileCard grid

CADFileCard.tsx
  Format badge (DWG | DXF | PDF | RVT — distinct colors)
  Description, file size, revit version (if RFA)
  Download count
  Download button (auth required)

FinishPalettePage.tsx
  Material tabs (Copper | Aluminum | Galvanized | Painted Steel)
  FinishChip grid
  "Download Complete Palette" button

FinishChip.tsx
  80×80px minimum
  hex_preview as background-color
  Upcharge badge if non-standard
  Click → FinishDetailModal

ResourceCenterPage.tsx
  Category filter tabs
  ResourceArticle list rendered from Supabase
  react-markdown with AFS prose styling

InstallationGuidePage.tsx
  StepList with StepCard components
  AIAdvisorSection below guide
  CommonMistakesAccordion
  PDFDownloadButton
```

---

## LAYER 10 — ADMIN PORTAL (`components/admin/`)

```
AdminDashboard.tsx
  KPI cards row (orders today, in production, ready to ship, rush count)
  RecentActivityFeed
  QuickActions (advance order status, upload photo)

QuoteRequestQueue.tsx
  List of incoming quote_requests
  Rush badge, status, submitted time
  Click → AdminQuoteRequestDetail

AdminQuoteRequestDetail.tsx
  Full customer submission read-only view
  "Generate Pricing" button → calls pricing engine
  LineItemPricingRow per item (shows cost basis, margin, suggested price, editable)
  FreightCalculatorPanel
  "Send Quote to Customer" button

ProductionQueueTable.tsx
  All active orders, sorted rush-first then oldest-first
  Status column with color coding
  "Advance" button per row
  StatusAdvancer.tsx: current status + advance button + note input

AdminOrderDetail.tsx
  Full order with StatusAdvancer prominent
  AdminNotes field (internal only)
  PreShipPhotoUploader
  PaymentInfo (Stripe data)
  Full OrderStatusHistory list

CustomerList.tsx
  Searchable, filterable table
  Export CSV

CustomerDetail.tsx
  Profile info (all editable)
  AccountSettings: role, pricing tier, net terms
  OrderHistory, QuoteHistory, CreditApplications
  AdminNotesLog (append-only, timestamped)

PricingAdminDashboard.tsx
  CommodityPriceTable (today's prices, changes)
  MarginRiskAlerts (for flagged materials)
  PricingRulesEditor (per-product editable table)
  HistoricalPriceChart (recharts)

--- Command Center (/admin/command-center) — beyond the original 10 layers,
    added for the Machine Bridge feature (see ARCHITECTURE.md §11) ---

PendingQuoteRequestCard.tsx
  Renders one quote_requests row (status = 'submitted') in the Pending
  Approval tab — reads from lib/data/pending-quote-requests.ts
  (PendingQuoteRequestRow type). Approve action → POST
  /api/admin/command-center/approve-quote-request. Exists because nothing
  currently auto-creates machine_jobs rows from real customer submissions
  (see SCHEMA.md's MACHINE BRIDGE TABLES note) — this card is what
  actually makes the Pending Approval tab show real incoming work, by
  reading quote_requests directly rather than waiting on machine_jobs.

CommandCenterJobCard.tsx
  Renders one machine_jobs row. Approve / Reject (reason required) /
  Request Changes / Mark as Sent to Machine actions depending on status —
  see ARCHITECTURE.md's Machine Job Lifecycle for the full state machine.

BendSequenceDiagram.tsx (components/studio/ — relocated from
  components/admin/ in afs-038, since the Profile Library page and
  FlashDraft's floating match preview needed to import it too; imported
  here as `@/components/studio/BendSequenceDiagram`)
  SVG reconstruction of a bend sequence from its stored steps — same
  turtle-graphics approach as FlashDraft's "Load from Library" — labeled
  approximate, not CAD-precision. Every SVG coordinate is rounded to 2
  decimal places before render (afs-038) — an unrounded float renders one
  ULP differently between Node's SSR pass and the browser's V8, which
  React flags as a hydration mismatch; this surfaced only once the
  component was first server-rendered, by the Profile Library page below
  (its only prior use, Command Center, is client-rendered).
  **Post-GEOMETRY_AUDIT.md (see PROFILE GEOMETRY ENGINE in
  STATE_OF_THE_BUILD.md):** its own inline `reconstructPoints` no longer
  does the turtle-graphics math itself — it now calls
  `computeProfilePoints()` from the new `lib/flashdraft/geometry.ts` and
  maps its own mm-unit `Bend` fields onto that shared function's
  unit-agnostic interface. Output is bit-for-bit unchanged (no unit
  conversion is introduced — mm values pass straight through). This same
  shared function now also backs `ProfileViewer3D.tsx`'s
  `buildProfilePoints` and `app/studio/draft/page.tsx`'s
  `loadFromLibrary`, which previously carried three independent,
  near-identical copies of this exact math (see GEOMETRY_AUDIT.md §3).

MachineBridgeStatusDot.tsx
  Polls /api/machine-bridge/status every 30s. Green if the bridge pinged
  within the last 90s (2x the bridge's own 30s poll interval), red
  otherwise. See STATE_OF_THE_BUILD.md for the bridge's current audited
  connectivity status.

app/admin/geometry-test/page.tsx (NEW — post-GEOMETRY_AUDIT.md)
  Internal validation tool only, not linked from NavBar.tsx or
  AdminShell.tsx's nav sections — reachable only by typing the URL
  directly. Server component, admin-gated (requireAdminUser, same
  redundant page-local check every /admin page does on top of
  app/admin/layout.tsx's own gate), service-role client. Renders the
  first 20 public+active machine_profiles side by side three ways: the
  BendSequenceDiagram SVG, a raw bend-data table (left/right leg inches,
  angle), and the literal computeProfilePoints() output coordinates — for
  visually cross-checking the shared geometry function against real
  production data. See PROFILE GEOMETRY ENGINE in STATE_OF_THE_BUILD.md.
```

---

## LAYER 11 — AI COMPONENTS (`components/ai/`)

```
ChatWidget.tsx
  Fixed bottom-right
  Collapsed: circular button, AFS logo, crimson bg, unread count badge
  Expanded: 380×520px panel, slides up
  MessageList, InputBar with send button
  TypingIndicator during AI response
  EscalationCard when escalation triggered

EscalationCard.tsx
  bg-afs-bg-surface border-l-4 border-afs-crimson
  Contact info for human handoff

AISpecWriterFlow.tsx
  See LAYER 9 — ArchitectPortal

AIProductFinder.tsx
  Embedded in /products as prominent search bar
  Conversational mode after first search

AIInstallationAdvisor.tsx
  Embedded in InstallationGuidePage.tsx
  Below static guide content
  Inline chat, not a popup

MaterialRecommendationPanel.tsx
  Slides in below MaterialSelector in quote wizard
  Triggered when selected material has long lead time
  2-3 recommendation cards with pros/cons

CrossSellPanel.tsx
  Shown after AutoMaterialCalculator in quote wizard
  Required accessories auto-added (with remove option)
  Recommended accessories with add checkbox
```

---

## LAYER 12 — DESIGN STUDIO (`components/studio/`, `app/studio/`)

Beyond the original 10 layers — added after Phase 0–8 shipped. `/studio` is
a primary NavBar destination (see LAYER 2).

```
ProfileViewer3D.tsx (components/studio/)
  Three.js viewer — ExtrudeGeometry built from a turtle-graphics walk of a
  `bends` array, offset into a thin ribbon by thicknessMm, then extruded.
  PerspectiveCamera + OrbitControls, Reset View/Top/Side/End presets.
  CSS2DRenderer dimension labels (leg lengths, bend angles, blank-width
  end cap) in JetBrains Mono. Material color/metalness/roughness table
  per material family. Runs a filletPolyline() pass (tangent-point
  circular fillet, clamped to ≤49% of each adjacent leg) before extruding
  when bend radii are present, so bends render as curved surfaces instead
  of sharp miters.
  afs-038: gained additive-only optional props — paintFace ('up'|'down'),
  paintColor, bareColor (render one face of the mesh in a finish color via
  a thin polygonOffset decal strip along the outer/inner ribbon boundary,
  the opposite face bare-metal-colored — used only by
  SubmitConfirmation3DModal below), plus autoRotateSpeed/
  autoRotateDurationMs (default 4 / 3000ms, matching the prior hardcoded
  behavior exactly when omitted). All default to the pre-afs-038 look, so
  the two pre-existing call sites below are visually unchanged.
  Used in three places: a "View 3D" modal on the upload/AI-results page
  (app/upload/page.tsx, defaults only), the standalone shareable route
  below (defaults only), and SubmitConfirmation3DModal (new paint-face
  props, autoRotateSpeed=6/autoRotateDurationMs=10000 for one full 360°
  over 10s). FlashDraft's own [2D View][3D View] toggle is GONE as of
  afs-038 — see its entry below.

ShareProfileButton.tsx (components/studio/)
  Client component — copies the current page URL to the clipboard. Used
  on the standalone profile-viewer route.

SubmitConfirmation3DModal.tsx (components/studio/ — NEW, afs-038)
  Full-screen dark-backdrop modal wrapping ProfileViewer3D at 600×500px,
  shown by FlashDraft on every "Submit for Quote" click before the quote
  request actually posts. For Kynar/Painted Steel/Vintage Steel materials
  only, shows "Please confirm your painted side" + a "Flip Paint Side"
  button (toggles the paintFace prop, which re-triggers the 10s rotation);
  non-painted materials skip straight to the two buttons: "Go back and
  edit" (closes, no submit) and "Looks correct — Submit Quote" (proceeds
  to the existing auth/guest-email submit flow, passing the confirmed
  paintFace along). Paint color is an approximation — the real Kynar
  Slate Gray hex from lib/data/catalog.ts's FINISHES for Kynar/Painted
  Steel, a hardcoded swatch for Vintage Steel — since FlashDraft has no
  real finish-color picker to source an exact value from.

BendSequenceDiagram.tsx (components/studio/)
  See LAYER 10 — ADMIN PORTAL (Command Center section) for its full
  entry; relocated there in afs-038, now shared by Command Center, the
  Profile Library grid below, and FlashDraft's floating match preview.

ProfileLibraryBrowser.tsx (components/studio/ — NEW, afs-038)
  Client component powering app/studio/library/page.tsx below. Search +
  category + blank-width-range + bend-count filters (all client-side,
  over the full profile list passed in as props), a responsive card grid
  (each card: BendSequenceDiagram SVG, name, blank width in/mm, bend
  count, "Fabricated N times", "Load into FlashDraft" link, "Compare"
  toggle), and a 3-item comparison tray fixed to the bottom of the
  viewport (left-48 to clear NavBar's rail, matching the rest of the
  site's fixed-element convention). The click-to-open card modal (added
  afs-042) now also lists a per-step bend breakdown below the diagram/
  stats — "Step N: left leg X", turn Y°, right leg Z" per bend, using the
  same `bends` prop data already fetched server-side for the diagram,
  formatted with `formatInches()` — a text-readable equivalent of the SVG
  for anyone who wants the exact numbers rather than reading them off the
  drawing.

app/studio/page.tsx
  Design Studio landing — 4 tab cards (grid-cols-1 sm:grid-cols-2
  lg:grid-cols-4, widened from a 3-column grid): Scan to Quote
  (→ /upload), Photo to Quote (→ /upload?tab=photos), FlashDraft
  (→ /studio/draft), and Custom Configurator (→ /configure, added
  afs-cs-002) — the last links to the existing standalone Configurator
  route unchanged; no route moved, no state shared between the two
  tools. afs-038 added a banner card below the tile grid linking to
  /studio/library.

--- FlashDraft (`app/studio/draft/page.tsx`) — a 12-file `useReducer`
    rewrite (`lib/flashdraft/` + `components/studio/flashdraft/`) was
    built and committed as afs-044 (508b5ee, 2026-07-15), then reverted
    the same day as afs-045 (b37d936) before it was used further.
    `components/studio/flashdraft/` still does NOT exist on disk — do not
    look for it. The single-file page.tsx below is the real, current
    implementation (confirmed via a fresh directory listing and `wc -l`,
    not carried forward from before the rewrite — it still includes every
    fix from afs-043, which landed before afs-044 and survived the revert
    untouched). See SESSION_STATE.md's afs-045 entry for why the rewrite
    was reverted.
    **`lib/flashdraft/` exists again as of the GEOMETRY_AUDIT.md
    follow-up work (see PROFILE GEOMETRY ENGINE in
    STATE_OF_THE_BUILD.md)** — but only one file,
    `lib/flashdraft/geometry.ts`, a small shared reconstruction utility
    unrelated to afs-044's reverted 12-file state-machine architecture.
    Do not confuse the two: this is not the rewrite coming back, it's a
    narrow extraction of math that was independently duplicated three
    times, landing on top of the single-file page.tsx that afs-045
    restored. ---

app/studio/draft/page.tsx ("FlashDraft")
  A large client-component page (2,268 lines), not a separate reusable
  component — the 2D canvas drawing tool lives directly in this file
  (two-panel: 320px controls + a canvas that fills all remaining
  viewport height/width via a ResizeObserver on its wrapper div).
  Draw/select/erase modes, click-and-drag segment drawing via Pointer
  Events (mouse + touch), 15°-angle and ⅛"-dimension snapping, Ctrl+Z/
  Ctrl+Y undo/redo, wheel zoom, middle-mouse/Space+drag pan, feet+inches
  length fields, debounced profile matching against
  app/api/studio/match-profile, Save Draft (localStorage), Load from
  Library (public machine_profiles, also triggerable via
  ?loadProfile=<id> from the Library page — read via
  `window.location.search` in a mount effect, not next/navigation's
  useSearchParams, to keep the page statically prerenderable), Submit
  for Quote. The canvas itself is drawn via a local CANVAS_COLORS
  constant — see DESIGN_TOKENS.md §10 for the exception this follows.
    • Load from Library / Open-library modal — `openLibrary()` and
      `loadFromLibrary()` now fetch `app/api/studio/library-list` and
      `app/api/studio/load-profile/[id]` (both NEW) instead of querying
      `machine_profiles`/`machine_profile_bends` directly with the
      session-bound browser client. Fixes a real RLS gap found by
      GEOMETRY_AUDIT.md §4: both tables' RLS policies require
      `auth.uid() IS NOT NULL` even on `is_public = true` rows, so a
      logged-out visitor got a silent empty result (an apparently-empty
      library, or a blank single-point canvas after "Load into
      FlashDraft") with no error shown. Both new routes use the
      service-role client server-side — `library-list` only ever returns
      public+active rows (no visibility check needed); `load-profile/[id]`
      enforces the actual privacy rule (public+active visible to anyone,
      private visible only to a logged-in admin, otherwise 404) — the
      same pattern `app/studio/library/page.tsx` and
      `app/studio/profile-viewer/[profileId]/page.tsx` already used
      server-side. Bend-sequence reconstruction inside `loadFromLibrary`
      itself is unchanged except that it now calls the shared
      `computeProfilePoints()` (see PROFILE GEOMETRY ENGINE in
      STATE_OF_THE_BUILD.md) instead of its own inline copy of the same
      math.
    • Leg-point dragging — pointerdown on an interior bend point arms
      `draggingVertexIndex`; pointermove repositions that one point
      directly (snapped to the ⅛" grid), with its two adjacent legs'
      lengths and the angle between them recomputed live since they're
      derived, not stored; pointerup commits one undo entry, but only if
      an actual drag happened (not a bare click-to-select). The dragged
      point renders at 12px vs. the normal 4px while active.
    • Angle indicators — a PathfinderEdge-style clean fixed-20px-radius
      arc between the two leg directions at each interior bend vertex
      (afs-crimson, or a warn color if the bend radius is too tight for
      the selected gauge), with a signed-degree label near it — no
      circle background. The bend RADIUS is still set via a left-panel
      numeric input; the ANGLE is set via a separate numeric field
      (`angleInputDraft`, commits on Enter/blur, rotates every point
      downstream of that joint rigidly around it — a hinge operation
      that preserves all leg lengths).
    • Hem tool — double-clicking either drawn endpoint opens a fixed
      `top:16px,right:16px` on-canvas popup (Open / Smashed / Teardrop —
      position and color fixed by afs-043, see below); each renders real
      fold geometry directly in the canvas draw loop (afs-crimson) and
      adds to the blank-width calculation used by both profile matching
      and the 3D preview. Hem data rides in the quote_requests.line_items
      JSONB payload as { type, gapIn } per endpoint.
    • Inline dimension input — selecting a leg segment shows a real
      `<input>` positioned at the segment's live screen midpoint (white
      bg, afs-ink-900 text, 1px afs-accent-green border, JetBrains Mono).
  The Profile Match panel: a prominent percentage + color bar (green ≥90
  / amber 70–89 / crimson <70), a "Fabricated N times in shop history"
  line (see lib/data/machine-profile-fabrication.ts — a bend-signature-
  similarity count over the full public+private catalog, not a literal
  audit trail), an "EXACT MATCH — Machine program ready" badge at ≥95%,
  and a floating 200×150px SVG preview panel (top-right of the canvas,
  closeable) for matches ≥70%, reusing BendSequenceDiagram.
  The [2D]/[3D] toggle is back (crimson-active/bg-afs-bg-raised-inactive,
  default 2D) — `[3D]` swaps the canvas for an inline `ProfileViewer3D`
  of the customer's current drawing, no submit required. Clicking
  "Submit for Quote" always opens SubmitConfirmation3DModal first
  (components/studio/) instead of submitting immediately.
  `MatchedProfile3DModal.tsx` and `ProfileDetailsModal.tsx`
  (components/studio/, both pre-existing and not previously documented
  in this file) are also used here: the former for the match panel's
  "View in 3D" button, the latter for the Save/Duplicate name+category
  form.
  **afs-043 fixes (2026-07-15, survived the afs-044/045 rewrite-and-
  revert round trip unchanged):** (1) the hem popup's position changed
  from tracking the double-click point to a fixed `top:16,right:16`
  inside the canvas's `relative` wrapper, so it can never overlap the
  drawing. (2) `renderHemAt` was rewritten — all three hem types now
  render in afs-crimson (`CANVAS_COLORS.hemLine`, was afs-accent-purple)
  instead of being too subtle to see: Open draws a fold line the length
  of the gap plus a parallel offset line and a perpendicular cap;
  Teardrop draws a filled semicircle sized to material thickness (0.0625"
  default, floored at 8px screen radius); Smashed draws two lines 2px
  apart on screen.

app/studio/library/page.tsx ("Profile Library" — NEW, afs-038)
  Server component — fetches all is_public/is_active machine_profiles
  (+ their bends, + a category join) via the service-role client, same
  RLS rationale as the profile-viewer route below (public-row reads still
  require auth.uid() under RLS, which would break anonymous browsing of
  what's meant to be a public resource page). Also computes fabrication
  counts once server-side via lib/data/machine-profile-fabrication.ts and
  passes everything to ProfileLibraryBrowser (above) as plain props.
  Linked from app/studio/page.tsx's new banner card and from NavBar.tsx
  (a plain "Profile Library" link next to "Design Studio" in both the
  left rail and top header link lists — no dropdown/submenu component
  exists in this codebase to nest it under "Design Studio", so it's a
  flat sibling link).

app/studio/profile-viewer/[profileId]/page.tsx
  Standalone shareable route — server component, fetches a machine_profiles
  row + its machine_profile_bends via the service-role client (RLS
  requires auth even for public rows, which would break anonymous
  sharing), full-screen ProfileViewer3D + ShareProfileButton. Enforces
  is_public / admin-only access in application code — a private profile
  404s exactly like a nonexistent one.
```

---

*COMPONENT_MAP.md | AFS | Reid Whitesides | June 2026*
*LAYER 12 updated for the afs-038 FlashDraft/Design Studio overhaul, 2026-07-14.*
*LAYER 1 rewritten to match the real components/ui/ directory (2 files, not ~20), 2026-07-14 (afs-041).*
*LAYER 12's FlashDraft entry rewritten for the afs-044 complete architecture rewrite (lib/flashdraft/ + components/studio/flashdraft/, 12 files replacing the old single-file page.tsx), 2026-07-15.*
*LAYER 12's FlashDraft entry corrected back to the single-file page.tsx after afs-044 was reverted (afs-045, commit b37d936), 2026-07-15 — lib/flashdraft/ and components/studio/flashdraft/ no longer exist. Also corrected two pre-existing staleness bugs found during this pass, unrelated to the revert: the bend-angle indicator and 2D/3D toggle descriptions still described superseded afs-034/afs-038 behavior instead of afs-040/afs-042's actual current rendering.*
*Updated after GEOMETRY_AUDIT.md and its follow-up centralization work: BendSequenceDiagram.tsx's entry (LAYER 10) now notes its reconstruction math is centralized in the new lib/flashdraft/geometry.ts; a new app/admin/geometry-test/page.tsx entry added (LAYER 10); LAYER 12's FlashDraft entry documents the Load from Library RLS fix (two new API routes, app/api/studio/library-list and app/api/studio/load-profile/[id]) and ProfileLibraryBrowser's new per-step bend breakdown in its card modal; the afs-044/045 blockquote corrected to note lib/flashdraft/ exists again (geometry.ts only — not the reverted 12-file architecture, and components/studio/flashdraft/ still does not exist). See STATE_OF_THE_BUILD.md's PROFILE GEOMETRY ENGINE section for full detail.*
