# PRD.md
## AFS — Product Requirements Document
**Platform:** AFS Architectural Flashing Supply — Digital Commerce and Resource Platform

---

## EXECUTIVE SUMMARY

AFS is a specialty sheet metal fabricator. Every piece they make is custom.
Their current process requires phone calls and manual quoting — which limits
capacity and creates friction for contractors and architects who want to work
digitally.

This platform eliminates that friction. Contractors submit complete material
specifications online. Architects get spec language and CAD details they can
use immediately. AFS receives structured, accurate submissions and responds
with formal quotes. Orders are tracked in real time from the fabrication floor
to the jobsite.

**Business model:** Request for Quote. No self-service pricing. Customers
specify what they need — AFS prices it internally and sends a formal quote.
This is how a specialty fabricator sells. It is not an e-commerce store.

---

## USERS AND PERSONAS

### Roofing Contractor
Needs: Accurate material quotes fast. Real-time order tracking to schedule crews.
Digital records for job costing and lender documentation.
Pain: Waiting days for a quote via phone. Not knowing when material will arrive.
Win condition: Submit a drawing, get a quote, track it live, crew shows up when
material is there.

### Architect / Specifier
Needs: CSI Division 07 spec language, AutoCAD fabrication details, Revit families,
material data sheets.
Pain: Writing specs from scratch. Hunting for CAD details. No digital resource
from fabricators.
Win condition: Pull the AFS spec section, drop in their CAD file, done.
AFS is specified on the project.

### Project Manager / General Contractor
Needs: Order tracking, delivery scheduling, team access, project organization.
Pain: Material showing up when crews aren't there. No visibility into fabrication.
Win condition: Delivery scheduled to the day. See exactly when material ships.

### AFS Estimator (Internal User)
Needs: Receive structured quote requests. Price them accurately and fast using
current commodity data. Send formal quotes to customers.
Win condition: Quote request arrives pre-organized. Pricing engine pre-populates
suggested prices. Estimator reviews, adjusts, sends. Done in minutes not hours.

---

## PLATFORM REQUIREMENTS

### R1 — Quote Request System (Must Have)
Contractors and architects submit material specifications online without calling.
The specification includes: profile type, material, gauge, finish, dimensions,
length, quantity, project notes. No prices are shown during this process.
AFS receives a structured submission in the admin portal.

### R2 — Blueprint Takeoff AI (Must Have)
Users upload construction drawings (DWG, DXF, PDF, images). AI reads the drawing,
identifies flashing profiles, extracts dimensions and quantities, and converts the
result to a quote request submission. Replaces manual quantity takeoff.

### R3 — Custom Flashing Configurator (Must Have)
Users specify exact custom dimensions with a live SVG profile diagram that updates
as they type. Output is a quote request submission with complete specifications.
Serves contractors who need non-standard profiles.

### R4 — Formal Quote Delivery (Must Have)
AFS estimators receive quote requests, run the internal pricing engine, and deliver
formal quotes to the customer's portal account. The customer sees prices for the
first time on the formal quote. Customer approves and payment is collected.

### R5 — Production Tracking (Must Have)
Real-time order status from submitted through fabrication stages to delivery.
Stage-by-stage timeline visible to customer. Automated notifications at each stage.
Pre-ship photos attached before shipping. Delivery scheduling tied to crew schedules.

### R6 — Architect Portal (Must Have)
AI-generated CSI Division 07 specification sections. AutoCAD fabrication details.
Revit families. Finish palette downloads. Material specification library.
Field installation guides. Everything an architect needs to specify AFS products.

### R7 — Internal Pricing Engine (Must Have — Admin Only)
Commodity-indexed pricing that uses real-time metal prices (copper, aluminum,
galvanized steel) and historical supplier price trends to calculate accurate,
margin-aware quotes. Trend analysis flags when commodity movements threaten margins.
Never visible to customers.

### R8 — Customer Portal (Must Have)
Logged-in dashboard with order history, quote history, delivery scheduling,
invoices, project organization, document vault, team accounts, and saved templates.

### R9 — AI Customer Support (Phase 7)
24/7 chatbot grounded in AFS product data, policies, and procedures. Handles
repetitive questions. Escalates disputes, complaints, and engineering questions
to humans. Never quotes prices.

### R10 — Administrative Operations (Must Have)
Admin portal for production queue management, status advancement, pre-ship photo
upload, customer management, pricing administration, and quote request handling.

---

## WHAT THIS PLATFORM IS NOT

- Not an e-commerce store with a cart and self-service checkout
- Not a project management tool competing with Procore or Buildertrend
- Not a financial reporting tool
- Not a CRM (customer data is stored but not a CRM feature set)
- Not an SEO platform (handled separately via Teratrix)

---

## PHASE PRIORITIES

**Phase 1 (Foundation — Built First):**
Blueprint upload and drawing tool. Maximum value delivered first.
Demonstrates core platform capability before any commerce is built.

**Phase 2–3 (Core Commerce):**
Quote request wizard. Configurator. Product catalog. Auth.
Checkout flow (payment after AFS delivers formal quote).

**Phase 4–5 (Portal + Architect):**
Full customer account portal. Delivery scheduling. Invoices.
Complete architect portal with AI spec generation.

**Phase 6–7 (Operations + AI):**
Admin production queue. Internal pricing engine UI. AI chatbot.
AI product finder and material recommendations.

**Phase 8 (Integrations):**
QuickBooks sync (conditional). Vercel Cron for commodity data.
Complete test suite. Production deployment.

---

## SUCCESS METRICS

- Quote requests submitted digitally vs. by phone (target: 60% digital in 6 months)
- Average time from request to formal quote sent (target: under 2 hours)
- "Where is my order" calls to AFS (target: 70% reduction)
- Architects who download from CAD library and subsequently specify AFS
- Admin quote turnaround time vs. pre-platform baseline

---

*PRD.md | AFS | Reid Whitesides | June 2026*
