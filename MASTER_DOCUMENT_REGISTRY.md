# MASTER_DOCUMENT_REGISTRY.md
## AFS — Document Registry
**Every document in this project. What to place in the FORGE project folder. Nothing else.**

---

## FOLDER STRUCTURE

```
C:\Users\manag\Documents\FORGE\projects\afs-website\
├── CLAUDE.md
├── BLUEPRINT.md
├── PRD.md
├── ARCHITECTURE.md
├── SCHEMA.md
├── DESIGN_TOKENS.md
├── COMPONENT_MAP.md
├── PRICING_ENGINE.md
├── SITEMAP.md
├── STATE_OF_THE_BUILD.md
├── SESSION_STATE.md
├── MASTER_DOCUMENT_REGISTRY.md
├── queue.yaml
└── specs\
    ├── SPEC_HOMEPAGE.md
    ├── SPEC_AUTH.md
    ├── SPEC_PRODUCT_CATALOG.md
    ├── SPEC_DRAWING_TOOL.md
    ├── SPEC_DOCUMENT_UPLOAD.md
    ├── SPEC_QUOTE_BUILDER.md
    ├── SPEC_FLASHING_CONFIGURATOR.md
    ├── SPEC_AUTO_MATERIAL_CALCULATOR.md
    ├── SPEC_PHOTO_TO_QUOTE_AI.md
    ├── SPEC_TRIM_LENGTH_OPTIMIZER.md
    ├── SPEC_AI_ORDER_VALIDATOR.md
    ├── SPEC_CHECKOUT.md
    ├── SPEC_STRIPE_INTEGRATION.md
    ├── SPEC_TAXJAR_INTEGRATION.md
    ├── SPEC_PURCHASE_ORDER_INTEGRATION.md
    ├── SPEC_ORDER_PORTAL.md
    ├── SPEC_PRODUCTION_TIMELINE.md
    ├── SPEC_DELIVERY_SCHEDULER.md
    ├── SPEC_PICKUP_SCHEDULING.md
    ├── SPEC_INVOICE_PORTAL.md
    ├── SPEC_MULTI_PROJECT_MANAGEMENT.md
    ├── SPEC_TEAM_ACCOUNTS.md
    ├── SPEC_SAVED_PROJECT_TEMPLATES.md
    ├── SPEC_ONLINE_CREDIT_APPLICATION.md
    ├── SPEC_NOTIFICATIONS.md
    ├── SPEC_RESEND_INTEGRATION.md
    ├── SPEC_EMAIL_TEMPLATES.md
    ├── SPEC_TWILIO_INTEGRATION.md
    ├── SPEC_GOOGLE_MAPS_INTEGRATION.md
    ├── SPEC_ARCHITECT_PORTAL.md
    ├── SPEC_AI_SPEC_WRITER.md
    ├── SPEC_CAD_BIM_LIBRARY.md
    ├── SPEC_FINISH_PALETTE.md
    ├── SPEC_CUSTOM_PROFILE_LIBRARY.md
    ├── SPEC_MATERIAL_SPEC_LIBRARY.md
    ├── SPEC_FIELD_INSTALLATION_GUIDES.md
    ├── SPEC_ARCHITECTURAL_RESOURCE_CENTER.md
    ├── SPEC_DESIGN_CONSULTATION.md
    ├── SPEC_ADMIN_PORTAL.md
    ├── SPEC_PRODUCTION_QUEUE.md
    ├── SPEC_PRICING_ADMIN.md
    ├── SPEC_CUSTOMER_MANAGEMENT.md
    ├── SPEC_LIVE_INVENTORY.md
    ├── SPEC_RUSH_ORDER.md
    ├── SPEC_FREIGHT_ESTIMATOR.md
    ├── SPEC_AI_CHATBOT.md
    ├── SPEC_AI_PRODUCT_FINDER.md
    ├── SPEC_AI_MATERIAL_RECOMMENDATIONS.md
    ├── SPEC_AI_INSTALLATION_ADVISOR.md
    ├── SPEC_AI_CROSS_SELL.md
    ├── SPEC_SUPABASE_INTEGRATION.md
    └── SPEC_QUICKBOOKS_INTEGRATION.md
```

---

## GOVERNANCE DOCUMENTS (12)

| # | File | Purpose |
|---|---|---|
| 1 | CLAUDE.md | Master index. Read first on every FORGE run. Platform model. |
| 2 | BLUEPRINT.md | Build phases, directory structure, quality gates, AI rules. |
| 3 | PRD.md | Platform requirements. User personas. What this is and is not. |
| 4 | ARCHITECTURE.md | Auth model, API patterns, data flow, RLS strategy, order lifecycle. |
| 5 | SCHEMA.md | 25 database tables. Full SQL with RLS policies and indexes. |
| 6 | DESIGN_TOKENS.md | Gunmetal color system from logo. Typography. Metal Edge CSS. Tailwind config. |
| 7 | COMPONENT_MAP.md | Every component with props, styling, and purpose. |
| 8 | PRICING_ENGINE.md | Internal commodity-indexed pricing. Admin only. Algorithm and admin UI. |
| 9 | SITEMAP.md | All 87 routes. Auth matrix. URL conventions. |
| 10 | STATE_OF_THE_BUILD.md | Build phase status. Updated by FORGE. |
| 11 | SESSION_STATE.md | Session handoff log. Updated by FORGE. |
| 12 | MASTER_DOCUMENT_REGISTRY.md | This file. |

---

## FORGE QUEUE (1)

| File | Purpose |
|---|---|
| queue.yaml | Phase 0–1 FORGE prompts. Copy to project root. |

---

## FEATURE SPECS (52)

### Foundation (3)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_HOMEPAGE.md | 3 | Homepage sections, components, placeholder policy |
| SPEC_AUTH.md | 3 | Registration, login, magic link, password reset, roles |
| SPEC_PRODUCT_CATALOG.md | 3 | Browse catalog. No prices. Drives to quote request. |

### Drawing Tool — Built First (2)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_DRAWING_TOOL.md | 1 | Blueprint Takeoff AI — upload, AI extraction, TakeoffResultsTable |
| SPEC_DOCUMENT_UPLOAD.md | 1 | Three-context upload: vault, CAD library, order attachments |

### Quote Request System (7)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_QUOTE_BUILDER.md | 2 | 4-step RFQ wizard. No prices shown. Submission to admin queue. |
| SPEC_FLASHING_CONFIGURATOR.md | 2 | Custom profile spec with live SVG. Submission output. No prices. |
| SPEC_AUTO_MATERIAL_CALCULATOR.md | 2 | Waste factor, accessory quantities. Quantities only — no pricing. |
| SPEC_PHOTO_TO_QUOTE_AI.md | 2 | Photo upload for field contractors. Identifies profiles, requires dimension entry. |
| SPEC_TRIM_LENGTH_OPTIMIZER.md | 2 | Cut list optimization from stock lengths. Quantities only. |
| SPEC_AI_ORDER_VALIDATOR.md | 2 | Dimension range and physical impossibility checks. Admin vs. customer scope. |
| SPEC_CHECKOUT.md | 3 | Payment collected after AFS delivers formal quote. Customer approves first. |

### Commerce Integrations (3)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_STRIPE_INTEGRATION.md | 3 | Card, ACH, deposit flows. Payment intent from AFS-set quote total. |
| SPEC_TAXJAR_INTEGRATION.md | 3 | Multi-state nexus compliance. Called at checkout on AFS-set amounts. |
| SPEC_PURCHASE_ORDER_INTEGRATION.md | 3 | PO number field on checkout. Company-level PO requirement toggle. |

### Customer Portal (10)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_ORDER_PORTAL.md | 4 | Dashboard, order list, order detail, public tracker. |
| SPEC_PRODUCTION_TIMELINE.md | 4 | Stage-by-stage fabrication timeline. Realtime updates. Admin advancement. |
| SPEC_DELIVERY_SCHEDULER.md | 4 | Jobsite delivery window booking. Tied to crew schedule. |
| SPEC_PICKUP_SCHEDULING.md | 4 | Pickup scheduling for local customers. |
| SPEC_INVOICE_PORTAL.md | 4 | Invoice downloads. AFS-generated prices. Statement view. |
| SPEC_MULTI_PROJECT_MANAGEMENT.md | 4 | Project folders for orders and documents. |
| SPEC_TEAM_ACCOUNTS.md | 4 | Multi-user company accounts. Roles and invitation flow. |
| SPEC_SAVED_PROJECT_TEMPLATES.md | 4 | Save quote request configurations for repeat orders. |
| SPEC_ONLINE_CREDIT_APPLICATION.md | 4 | Net terms application. Trade references. Admin review. |
| SPEC_NOTIFICATIONS.md | 4 | Email and SMS at each production milestone. Preference management. |

### Communication Integrations (4)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_RESEND_INTEGRATION.md | 4 | Resend client setup, domain verification, sending pattern. |
| SPEC_EMAIL_TEMPLATES.md | 4 | All 14 email templates with AFS branding. Content per template. |
| SPEC_TWILIO_INTEGRATION.md | 4 | SMS setup, A10DLC registration, opt-in compliance, webhook. |
| SPEC_GOOGLE_MAPS_INTEGRATION.md | 4 | Address autocomplete at checkout. Contact page map. |

### Architect Portal (9)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_ARCHITECT_PORTAL.md | 5 | Portal landing, copper accent design, architect account gating. |
| SPEC_AI_SPEC_WRITER.md | 5 | CSI Division 07 spec generation. Claude API. DOCX output. |
| SPEC_CAD_BIM_LIBRARY.md | 5 | DWG/DXF/PDF/Revit downloads. Admin upload. Download logging. |
| SPEC_FINISH_PALETTE.md | 5 | Color chips. Material tabs. PDF palette download. |
| SPEC_CUSTOM_PROFILE_LIBRARY.md | 5 | Saved custom configs. Reorder flow. SVG preview. |
| SPEC_MATERIAL_SPEC_LIBRARY.md | 5 | ASTM references, data sheets, material technical data per profile. |
| SPEC_FIELD_INSTALLATION_GUIDES.md | 5 | Step-by-step guides per profile. AI advisor layer on top. |
| SPEC_ARCHITECTURAL_RESOURCE_CENTER.md | 5 | CMS-driven knowledge base. Standards, FAQs, spec writing guides. |
| SPEC_DESIGN_CONSULTATION.md | 5 | Consultation request form with file upload. Scheduling preference. |

### Admin + Operations (6)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_ADMIN_PORTAL.md | 6 | Admin shell, dashboard KPIs, audit logging, role enforcement. |
| SPEC_PRODUCTION_QUEUE.md | 6 | Order queue, status advancement, quick advance interaction. |
| SPEC_PRICING_ADMIN.md | 6 | Pricing rules editor, commodity dashboard, trend alerts, bulk CSV import. |
| SPEC_CUSTOMER_MANAGEMENT.md | 6 | Customer list and detail. Role management. Append-only admin notes. |
| SPEC_LIVE_INVENTORY.md | 6 | Stock signal system (stock/made-to-order/special-order). ERP-ready. |
| SPEC_RUSH_ORDER.md | 6 | Rush flag on submissions. Admin rush queue priority. Surcharge. |
| SPEC_SHOP_CALLOUTS.md | 6 | Steve’s arrow + red note on a FlashDraft profile, read in Shop View. Gating, anchoring, migration 051. **Lives in the repo ROOT, not specs/** — it documents a feature built outside the FORGE queue. |

### Freight (1)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_FREIGHT_ESTIMATOR.md | 6 | Internal admin freight calculator. Appears on formal quotes only. |

### AI Layer (5)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_AI_CHATBOT.md | 7 | 24/7 support chatbot. Knowledge base. Streaming. Escalation rules. |
| SPEC_AI_PRODUCT_FINDER.md | 7 | Conversational product search. Catalog context injection. |
| SPEC_AI_MATERIAL_RECOMMENDATIONS.md | 7 | Alternative material suggestions on long lead times. |
| SPEC_AI_INSTALLATION_ADVISOR.md | 7 | AI layer on installation guides. Follow-up question handling. |
| SPEC_AI_CROSS_SELL.md | 7 | Accessory recommendations on quote submissions. |

### Integrations (2)
| File | Phase | What It Covers |
|---|---|---|
| SPEC_SUPABASE_INTEGRATION.md | All | Three-client pattern, RLS testing, storage buckets, Realtime. |
| SPEC_QUICKBOOKS_INTEGRATION.md | 8 | QBO OAuth, invoice sync. Conditional — only if QBO confirmed. |

---

## TOTALS

```
Governance documents:   12
FORGE queue file:        1
Feature specs:          52
─────────────────────────
Total files:            65
```

---

## WHAT DOES NOT EXIST IN THIS PROJECT

- No `.docx` files — all documentation is `.md`
- No `SPEC_CONTRACTOR_PRICING_PORTAL.md` — deleted (incorrect model)
- No customer-facing pricing component specs — RFQ model, no prices to customers
- No light mode / dark mode toggle — single gunmetal theme
- No SEO infrastructure — handled by Teratrix, explicitly excluded
- No `SPEC_CHECKOUT.md` with self-service cart — checkout comes after AFS quote approval

---

*MASTER_DOCUMENT_REGISTRY.md | AFS | Reid Whitesides | June 2026*
