# COMPONENT_MAP.md
## AFS — Complete Component Map
**Every component by section. Used by FORGE to know what exists before creating new files.**

---

## LAYER 1 — UI PRIMITIVES (`components/ui/`)

Reusable atomic components. No business logic. No data fetching.

```
Button.tsx
  Props: variant ('primary'|'secondary'|'ghost'|'danger'|'copper')
         size ('sm'|'md'|'lg')
         loading (boolean)
         disabled (boolean)
         asChild (boolean — for link wrapping)
  Variants:
    primary:   bg-afs-crimson hover:bg-afs-crimson-hover text-white metal-edge-red
    secondary: border border-[var(--afs-border)] text-afs-chrome-mid hover:bg-afs-bg-surface
    ghost:     transparent text-afs-chrome-base hover:text-afs-chrome-mid
    danger:    bg-afs-crimson-dim hover:bg-afs-crimson text-white
    copper:    bg-afs-copper hover:bg-afs-copper-hover text-white (architect portal)

Badge.tsx
  Props: variant ('success'|'warning'|'error'|'chrome'|'crimson'|'copper'|'info')
         size ('sm'|'md')
  Purpose: Status indicators, role labels, format tags

Card.tsx
  Props: variant ('default'|'feature'|'data'|'stat'|'copper')
  default: bg-afs-bg-raised border border-[var(--afs-border)] rounded metal-edge
  feature: bg-afs-bg-surface border-[var(--afs-border-strong)] metal-edge-red
  data:    bg-afs-bg-raised border-[var(--afs-border)] rounded-none (sharp edges)
  stat:    bg-afs-bg-dim border-l-2 border-afs-crimson
  copper:  bg-afs-bg-raised border border-afs-copper metal-edge-copper

Input.tsx
  Styles: bg-afs-bg-overlay border border-[var(--afs-border)]
          focus:border-afs-crimson outline-none font-body text-afs-chrome-mid
  Variants: text | number | email | tel | search

DataInput.tsx
  Extends Input.tsx
  Font: font-data (JetBrains Mono)
  Suffix/prefix slot (for " symbol, LF units)
  Used for: dimension inputs, quantities, part numbers

Select.tsx
  Matches Input.tsx styling
  Custom chevron icon in afs-chrome-base color

Textarea.tsx
  Matches Input.tsx styling
  Resize: vertical only

Checkbox.tsx
  Crimson checked state
  Custom styling — no browser default

RadioGroup.tsx + RadioCard.tsx
  RadioCard: full-card clickable radio with border highlight on selected
  Selected: border-afs-crimson bg-afs-crimson-ghost

Spinner.tsx
  Sizes: sm | md | lg
  Color: inherits currentColor — use with text-afs-crimson or text-afs-chrome-mid

Tooltip.tsx
  Dark bg-afs-bg-raised, font-body text-xs text-afs-chrome-mid
  Arrow indicator

Modal.tsx
  Backdrop: bg-afs-bg-modal (dark overlay)
  Panel: bg-afs-bg-raised border border-[var(--afs-border)] metal-edge
  Max width variants: sm (480px) | md (640px) | lg (800px)

Toast.tsx
  Position: bottom-right, stacked
  Variants: success | error | warning | info
  Auto-dismiss: 4s default

Table.tsx
  Header: bg-afs-bg-surface text-afs-chrome-mid font-heading text-sm uppercase tracking-wide
  Row: bg-afs-bg-raised hover:bg-afs-bg-surface
  Row alt: bg-afs-bg-surface
  Border: border-b border-[var(--afs-border)]

Pagination.tsx
  Used with Table.tsx
  Crimson active page indicator

Tabs.tsx + Tab.tsx
  Underline style — active tab has border-b-2 border-afs-crimson

Accordion.tsx + AccordionItem.tsx
  Chevron rotates on open
  Smooth height transition

ConfirmModal.tsx
  Extends Modal.tsx
  Destructive confirm: danger Button variant
  Text: "Type DELETE to confirm" for irreversible actions

EmptyState.tsx
  Props: icon | title | description | actionLabel | actionHref
  Centered layout, muted text, optional CTA button

FileTypeIcon.tsx
  Returns correct icon per file extension
  Types: PDF | DWG | RVT | DXF | DOC | XLS | IMG | ZIP | Generic
  Color: afs-chrome-base, hover: afs-crimson
```

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

BendSequenceDiagram.tsx
  SVG reconstruction of a bend sequence from its stored steps — same
  turtle-graphics approach as FlashDraft's "Load from Library" — labeled
  approximate, not CAD-precision.

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
  PerspectiveCamera + OrbitControls (3s auto-rotate then stop), Reset
  View/Top/Side/End presets. CSS2DRenderer dimension labels (leg lengths,
  bend angles, blank-width end cap) in JetBrains Mono. Material color/
  metalness/roughness table per material family. Runs a filletPolyline()
  pass (tangent-point circular fillet, clamped to ≤49% of each adjacent
  leg) before extruding when bend radii are present, so bends render as
  curved surfaces instead of sharp miters.
  Used in three places: FlashDraft's [2D View][3D View] toggle, a "View
  3D" modal on the upload/AI-results page (app/upload/page.tsx), and the
  standalone shareable route below. Does NOT render its own [2D][3D]
  toggle — that lives once, in FlashDraft's own integration.

ShareProfileButton.tsx (components/studio/)
  Client component — copies the current page URL to the clipboard. Used
  on the standalone profile-viewer route.

app/studio/page.tsx
  Design Studio landing — 3 tab cards: Scan to Quote (→ /upload), Photo to
  Quote (→ /upload?tab=photos), FlashDraft (→ /studio/draft).

app/studio/draft/page.tsx ("FlashDraft")
  A large client-component page, not a separate reusable component — the
  2D canvas drawing tool lives directly in this file (two-panel: 380px
  controls + flex canvas). Draw/select/erase modes, click-and-drag segment
  drawing via Pointer Events (mouse + touch), 15°-angle and 1/8"-dimension
  snapping, Ctrl+Z/Ctrl+Y undo/redo, wheel zoom, middle-mouse/Space+drag
  pan, feet+inches length fields, draggable per-bend radius handles
  (afs-accent-green handle, afs-accent-purple "R: 0.5""-style label —
  see DESIGN_TOKENS.md §10), debounced profile matching against
  app/api/studio/match-profile, Save Draft (localStorage), Load from
  Library (public machine_profiles), Submit for Quote. The canvas itself
  is drawn via a local CANVAS_COLORS constant — see DESIGN_TOKENS.md §10
  for the exception this follows.

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
