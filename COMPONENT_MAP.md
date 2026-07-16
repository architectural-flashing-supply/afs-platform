# COMPONENT_MAP.md
## AFS — Complete Component Map
**Every component by section. Used by FORGE to know what exists before creating new files.**

---

## LAYER 1 — UI PRIMITIVES (`components/ui/`)

**Only two files actually exist here — verified 2026-07-14 (afs-041) against
the real `components/ui/` directory listing, not assumed from an earlier
design plan.** This layer was originally specced with ~20 shared atomic
primitives (Button, Card, Input, DataInput, Select, Textarea, Checkbox,
RadioGroup/RadioCard, Spinner, Tooltip, Modal, Toast, Table, Pagination,
Tabs/Tab, Accordion/AccordionItem, ConfirmModal, FileTypeIcon) — none of
those were ever built. Every page in this codebase hand-rolls its own
Tailwind buttons/inputs/modals/tables inline instead of importing from
this layer (confirmed by grep — no file outside `components/ui/` imports
from `@/components/ui/Button`, `@/components/ui/Modal`, etc., because
those files don't exist to import). Reusable atomic components. No
business logic. No data fetching.

```
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

If a future session builds any of the previously-specced primitives above,
add them here individually as they're actually created — don't restore
the old speculative list wholesale, since most of those component
designs (variant names, styling details) were never validated against a
real build either.

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

MachineBridgeStatusDot.tsx
  Polls /api/machine-bridge/status every 30s. Green if the bridge pinged
  within the last 90s (2x the bridge's own 30s poll interval), red
  otherwise. See STATE_OF_THE_BUILD.md for the bridge's current audited
  connectivity status.
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
  site's fixed-element convention).

app/studio/page.tsx
  Design Studio landing — 3 tab cards: Scan to Quote (→ /upload), Photo to
  Quote (→ /upload?tab=photos), FlashDraft (→ /studio/draft). afs-038
  added a banner card below the 3-tile grid linking to /studio/library.

--- FlashDraft (`app/studio/draft/page.tsx` + `lib/flashdraft/` +
    `components/studio/flashdraft/`) — REWRITTEN afs-044 (2026-07-15).
    The prior single ~2,270-line page.tsx (all state as local useState,
    geometry as a flat point polyline) was replaced with a 12-file
    useReducer architecture: a pure-data state machine in lib/flashdraft/,
    presentation split into components/studio/flashdraft/, and page.tsx
    reduced to an orchestrator. Everything below is current as of
    commit 508b5ee. ---

lib/flashdraft/types.ts
  Every FlashDraft type — no runtime code. `GeoPoint` (world space,
  inches) vs. `CanvasPoint` (screen-pixel space) are kept as distinct
  types on purpose so a raw pixel can't be passed where geometry math
  expects inches. `Leg` (startGeo/endGeo/lengthIn/angleRad/hems: Hem[]),
  `BendPoint` (geo/angleDegrees — SIGNED, driving both the display label
  and the downstream-rotation edit/radiusIn/incomingLegId/outgoingLegId),
  `Hem` (legId/distanceFromStartIn/lengthIn/type/gapIn), and
  `ProfileGeometry` ({ legs, bendPoints, hems }) are the geometry graph
  that replaced the old flat point array. `ProfileState` is the
  full-profile record (geometry + name/revision/material/gauge/length/
  quantity/notes/blankWidthIn/bendCount/hemCount/paintFace) — this is
  what gets persisted to `saved_configurations.dimensions`.
  `materialId`/`gaugeId` on ProfileState hold the catalog STRING
  identifiers from lib/data/catalog.ts (e.g. "Copper"), not database
  UUIDs — saved_configurations.material_id/gauge_id are real FKs into
  materials/gauges (SCHEMA.md), but that catalog data is an existing
  CLAUDE.md Data Blocker, so those FK columns stay null on save, exactly
  as the pre-rewrite page already did. `InteractionState` (a discriminated
  union: IDLE / DRAWING / SELECTED_LEG / SELECTED_BEND / SELECTED_HEM /
  DRAGGING_BEND / DRAGGING_HEM_ENDPOINT / DRAWING_HEM / PANNING) and
  `FlashDraftAction` (every dispatchable action) are the reducer's
  vocabulary. `FlashDraftState` is the top-level shape held by
  page.tsx's `useReducer` (profile/interaction/transform/activeView/
  hemPopup/history/future/isDirty). `QuoteSubmissionProfile` is the
  richer geometry payload page.tsx attaches to the quote-request item
  as `flashdraftGeometry` (see api/quote-requests below). `HitResult` is
  geometry.ts's `hitTest` return shape.

lib/flashdraft/geometry.ts
  Pure geometry math — geo↔canvas conversion (`geoToCanvas`/
  `canvasToGeo`, honoring `CanvasTransform`'s scale + panOffsetX/Y, Y
  flipped so positive inches render upward), distance helpers
  (`geoDistance`, `pixelDistance`), `lineAngleRad`, `formatInches`
  (re-exports lib/utils/format-inches.ts's fractional-inch formatter —
  single source of truth, not reimplemented), `snapAngle`/`snapLength`
  (15°/⅛" increments, always on — there's no dispatchable action to
  toggle snapping, see the page.tsx entry below), `pointAlongLeg`/
  `closestTOnLeg`/`distanceToLeg`, `signedAngleBetween` (the vertex-
  relative angle convention BendPoint.angleDegrees uses), `rotatePoint`/
  `centroidOfGeometry` (used by ROTATE_LEFT/RIGHT and the bend-angle
  downstream rotation), `dragBendPoint` (moving a bend point stretches
  its incoming leg to reach the new position while translating the
  outgoing leg and everything downstream by the same delta, preserving
  every downstream leg's length and direction — the "hinge" behind
  dragging a bend), and `hitTest` (priority: bend point > hem endpoint >
  leg > nothing).

lib/flashdraft/blankWidth.ts
  `computeBlankWidth(geometry, materialId, gaugeId)` — leg lengths + hem
  lengths + a real K-factor bend-allowance formula per bend
  (`(π/180) × |angleDegrees| × (radiusIn + K × thicknessIn)`), replacing
  the pre-rewrite page's fixed-fold-depth estimate. `materialId`/
  `gaugeId` are the same catalog strings as ProfileState (see types.ts
  above) — `materialCategoryFromCatalog` and `gaugeThicknessInFromCatalog`
  classify them via regex against the same catalog string set
  ProfileViewer3D's MATERIAL_APPEARANCE table already uses, with a
  fallback to lib/utils/gauge-thickness.ts's parser for any gauge string
  outside the literal lookup table (0.063" aluminum, zinc mm gauges).

lib/flashdraft/renderer.ts
  All `<canvas>` 2D drawing, called once per render from
  FlashDraftCanvas's effect. `CANVAS_COLORS` is the documented
  literal-hex exception (DESIGN_TOKENS.md §10) — `hemLine`/`leg`/
  `bendArc` are all afs-crimson, `legSelected`/`selectionRing` are a
  blue accent not otherwise in the afs-* palette (canvas-only, same
  exception). `renderGrid` (⅛"-minor/1"-major grid + axes),
  `renderLeg` (line + a rotated dimension label offset 16px
  perpendicular), `renderBendPoint` (handle circle + an angle arc with
  an arrowhead and a signed-degree label — replaces the pre-rewrite
  page's translucent bend-circle handle), `renderHem` (Open: fold line +
  parallel gap-offset line + perpendicular cap + length label; Smashed:
  two lines 2px apart on screen; Teardrop: fold line + a filled
  semicircle sized to material thickness, floored at 8px screen radius
  regardless of zoom), `renderDragPreview`/`renderHemPreview` (dashed
  in-progress lines), and `renderAll` (the entry point — draws
  everything in geometry, then the live drag/hem preview for whatever
  `state.interaction` currently is). `renderAll` takes an additive
  optional `hover` param beyond its literal spec signature — hover
  (which leg/bend to highlight, what cursor to show) is tracked as local
  state inside FlashDraftCanvas rather than dispatched through the
  reducer, so it doesn't round-trip history on every mouse move; this is
  the only way for that local state to reach the renderer.

lib/flashdraft/reducer.ts
  `initialFlashDraftState` + `flashDraftReducer` — the whole
  interaction/geometry state machine. Every pointer/keyboard/toolbar/
  form action funnels through here; no component holds its own geometry
  state. Notable behavior: continuing the polyline from the last
  committed point takes priority over every other hit-test on
  POINTER_DOWN (checked after bend/hem-endpoint hits specifically, so an
  existing hem or bend sitting at that same point stays reachable) — a
  real interaction bug (drawing a second leg silently turned into an
  aborted hem-drag instead) was found and fixed here via live Playwright
  verification, not caught by tsc or the build. Hems start only via
  DOUBLE_CLICK, matching the pre-rewrite page's proven precedent, not the
  click-and-drag-from-a-leg-end approach an earlier draft of this file
  used. `SET_BEND_RADIUS`/`SET_HEM_GAP` don't push undo history
  (continuous number-input edits); `SET_LEG_LENGTH`/`SET_BEND_ANGLE`/
  hem-type/length changes and every geometry-creating gesture do.
  Deleting a leg bridges the gap by translating everything downstream of
  it to meet the leg before it ("reattach if possible"); deleting a bend
  merges its two adjacent legs into one straight leg and drops any hems
  that were on either of them (documented tradeoffs for a genuinely
  ambiguous edge case — see SESSION_STATE.md's afs-044 entry).

components/studio/flashdraft/FlashDraftCanvas.tsx
  `interface FlashDraftCanvasProps { state: FlashDraftState; dispatch:
  React.Dispatch<FlashDraftAction>; onSizeChange?: (width, height) =>
  void }` — not exported (page.tsx is the only consumer). Owns the
  `<canvas>` element, a ResizeObserver on its wrapper div (reporting size
  up via onSizeChange, same pattern as the pre-rewrite page), the
  space-key-held ref for space+drag panning, and local (non-dispatched)
  hover state (see renderer.ts above). Pointer/wheel/double-click
  handlers translate DOM events to pixel coordinates and dispatch the
  corresponding FlashDraftAction — no geometry logic lives here, only
  event→action translation and cursor derivation from
  `state.interaction`/hover.

components/studio/flashdraft/FlashDraftToolbar.tsx
  `interface FlashDraftToolbarProps { state; dispatch; onNew; onOpen;
  onSave; onDuplicate; onEditName; isAuthenticated: boolean; currentZoom:
  number; canvasSize: { width; height } }` — not exported. Two rows of
  icon buttons (file actions: New/Open/Save/Duplicate/Edit Name/Print;
  canvas actions: Fit to Screen/Center/Zoom In/Zoom Out/zoom-%
  reset/Undo/Redo/Rotate Left/Rotate Right/Delete/Prev/Next/2D/3D) plus a
  hint-text line. File actions are callback props (page.tsx owns modal
  state for them); canvas actions dispatch FlashDraftActions directly
  (including two additive-beyond-spec actions, `SET_ZOOM` and
  `SELECT_ADJACENT_BEND`, added because the zoom-% reset button and
  Prev/Next needed a way to reach the reducer that the literal action
  list didn't define one for).

components/studio/flashdraft/FlashDraftPropertiesPanel.tsx
  `interface FlashDraftPropertiesPanelProps { state; dispatch }` — not
  exported. Renders one of four things based on `state.interaction.type`:
  a profile summary (IDLE — blank width/bend count/hem count/revision),
  a feet/inches/⅛"-fraction leg-length editor (SELECTED_LEG), an
  angle/radius editor with local draft-string state committed on
  Enter/blur (SELECTED_BEND), or a hem type/length/gap editor
  (SELECTED_HEM, gap field only shown for type 'open'). The leg-length
  and hem-length editors share one internal `LengthEditor` component (not
  exported) so both stay in sync if the fraction-snapping logic changes.

components/studio/flashdraft/HemPopup.tsx
  `interface HemPopupProps { hemPopup: HemPopupState; dispatch;
  currentHem: Hem | null }` — not exported. Renders only when
  `hemPopup.visible && currentHem`. Fixed `top: 16px, right: 16px`
  inside the canvas's `relative` wrapper (so it can never overlap the
  drawing — the pre-rewrite page originally positioned this near the
  double-click point, which afs-043 fixed before this rewrite carried
  the fixed positioning forward). Open/Smashed/Teardrop buttons dispatch
  `SELECT_HEM_TYPE_FROM_POPUP`; a gap-inches number input (Open only)
  dispatches `SET_HEM_GAP`.

components/studio/flashdraft/FlashDraftProfileInfo.tsx
  `interface FlashDraftProfileInfoProps { profile: ProfileState;
  dispatch }` — not exported. Top-left canvas overlay: click-to-edit
  profile name (local `editingName` state, commits via SET_PROFILE_NAME
  on every keystroke, matching the pre-rewrite page's live-typing
  behavior) plus blank width/bend count/hem count/revision — the same
  four figures FlashDraftPropertiesPanel's IDLE view shows, kept
  independently since one is a canvas overlay and the other is a
  left-panel block.

components/studio/flashdraft/SubmitFlow.tsx
  `export interface SubmitFlowProps { bends: ProfileBend[]; blankWidthMm;
  material; gauge; thicknessMm; profileName; requestNumber: string |
  null; paintFace: PaintFace | null }` (exported — page.tsx imports the
  type). Full-screen post-submission confirmation shown after a quote
  request successfully posts: one auto-rotation of the confirmed profile
  via ProfileViewer3D (reusing the same autoRotateSpeed/
  autoRotateDurationMs and paint-face utilities as
  SubmitConfirmation3DModal, from lib/utils/paint-appearance.ts), then
  reveals a "View My Requests" link to /account/quotes after
  ROTATE_DURATION_MS + 1s.

app/studio/draft/page.tsx ("FlashDraft" — orchestrator)
  No longer holds geometry state directly — `useReducer(flashDraftReducer,
  initialFlashDraftState)` is the single source of truth, passed down as
  `state`/`dispatch` to every component above. What's left in page.tsx:
  material/gauge/length/quantity/notes form fields (dispatching SET_*
  actions), global keyboard shortcuts (Ctrl+Z/Y, Escape, Delete —
  forwarded as KEY_DOWN actions, skipped while focus is in a text field),
  the debounced profile-match fetch against api/studio/match-profile
  (600ms, gated on ≥2 legs) and its split-screen match panel (inline
  JSX, not a separate component — reuses BendSequenceDiagram), Save/
  Duplicate via ProfileDetailsModal + saved_configurations (material_id/
  gauge_id left null — see types.ts above), Load from Library (an inline
  modal against public machine_profiles, plus the ?loadProfile=<id>
  deep-link from the Library page — both reconstruct a point polyline via
  the same turtle-graphics walk BendSequenceDiagram uses, then convert it
  to a Leg/BendPoint graph via a local `pointsToGeometry` helper), the
  2D/3D view toggle (`ProfileViewer3D` directly when `activeView==='3d'`),
  quote submission (validates → SubmitConfirmation3DModal → POST
  api/quote-requests → SubmitFlow on success), and a `?loadProfile=<id>`
  mount effect. One deliberate behavior change from the pre-rewrite page:
  submission requires sign-in — there's no guest-email-capture path
  anymore, even though api/quote-requests still accepts one server-side
  (see SESSION_STATE.md's afs-044 entry). `MatchedProfile3DModal.tsx` and
  `ProfileDetailsModal.tsx` (both components/studio/, both pre-existing —
  unchanged by afs-044, and not previously documented in this file) are
  used here: the former for the match panel's "View in 3D" button, the
  latter for the Save/Duplicate name+category form.

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
