import type { KnowledgeChunk } from './types';

// Customer-facing feature knowledge extracted from
// specs/SPEC_CUSTOM_PROFILE_LIBRARY.md, specs/SPEC_QUOTE_BUILDER.md,
// specs/SPEC_PHOTO_TO_QUOTE_AI.md, and specs/SPEC_ARCHITECT_PORTAL.md.
// (The Custom Flashing Configurator this file previously also drew from,
// specs/SPEC_FLASHING_CONFIGURATOR.md, was eliminated hpd-002 — redundant
// with FlashDraft — and its two knowledge chunks removed.)
//
// These specs are implementation documents (component names, API routes,
// TypeScript interfaces, Playwright tests, SQL). None of that belongs in a
// customer-facing chat context, so each chunk below is a hand-written
// summary of what the feature does and how a customer/architect uses it —
// not a dump of the spec file itself. Pricing is never mentioned per
// CLAUDE.md's RFQ model (no dollar amounts appear anywhere in this file).
export const specFilesKnowledge: KnowledgeChunk[] = [
  {
    id: 'spec-custom-profile-library',
    category: 'AFS Platform Features',
    subcategory: 'Custom Profile Library',
    topic: 'Saved Custom Profile Library — past custom designs, searchable and reorderable',
    content:
      'The Custom Profile Library (/architects/custom-profiles, any signed-in customer or architect) is a personal library of a customer\'s own past custom designs — both configurations they explicitly saved from FlashDraft and custom-dimension profiles pulled from their own past orders. Each entry shows a diagram, material and gauge, dimensions, and either "Last ordered" or "Saved" with a date, plus how many times it\'s been ordered if it came from order history. Customers can search and filter by profile type, material, or date range, then reorder a past design directly — so a unique profile only ever has to be specified once.',
    keywords: ['custom profile library', '/architects/custom-profiles', 'past custom designs', 'searchable profiles', 'reorder profile'],
  },
  {
    id: 'spec-quote-wizard-overview',
    category: 'AFS Platform Features',
    subcategory: 'Quote Wizard',
    topic: 'Quote Request Wizard — guided 4-step specification at /quote',
    content:
      'The Quote Request Wizard (/quote) is the primary path for contractors who don\'t have drawings to upload. It steps a customer through 4 guided screens — profile and material selection, dimensions, quantity and project details, then a final review — to build a complete specification without needing to draw anything. A single quote request can include multiple different profiles: after finishing one item, "Add Another Profile" returns to the start while keeping everything already entered. No prices, estimates, or totals appear at any step — submitting creates a quote request that AFS\'s estimators price and return as a formal quote to the customer\'s account.',
    keywords: ['quote wizard', 'quote request wizard', '/quote', 'guided quote', 'multi-item quote', 'add another profile'],
  },
  {
    id: 'spec-quote-wizard-guidance',
    category: 'AFS Platform Features',
    subcategory: 'Quote Wizard',
    topic: 'Live diagram, dimension guidance, and waste factor in the Quote Wizard',
    content:
      'While a customer enters dimensions in the Quote Wizard, a profile diagram updates live to match, and each field shows the allowed minimum and maximum for that profile so the customer knows they\'re in range before submitting. If a combination of dimensions is physically impossible, the wizard shows a warning the customer can review and acknowledge rather than silently blocking them. The wizard also automatically figures the extra material quantity needed to account for standard fabrication waste and shows that as an adjusted linear-footage total — quantity math only, never a price. Relevant accessories for the selected profile are suggested at this step as well, shown by name and typical use with no pricing attached.',
    keywords: ['live diagram', 'dimension validation', 'waste factor', 'accessory suggestions', 'quote wizard guidance'],
  },
  {
    id: 'spec-photo-to-quote',
    category: 'AFS Platform Features',
    subcategory: 'Photo to Quote',
    topic: 'Photo-to-Quote — mobile-first quoting from jobsite photos',
    content:
      'Photo-to-Quote (the "Upload Photos" tab on /upload) is built for field contractors who don\'t have formal drawings — they photograph an existing flashing installation that needs repair or replacement (up to 10 photos, mobile camera capture supported) and AFS\'s AI identifies the profile type, material, and general condition (good, aging, damaged, or failed) directly from the photos. Photos are jobsite images, not technical drawings, so the AI can identify what something is but cannot reliably measure it — customers always enter dimensions themselves from their own site measurements, and this is stated clearly before upload so no one mistakes an identification for a measurement. For dimensions extracted automatically from an actual technical drawing (PDF, AutoCAD, or Revit), the separate Drawing Upload tab on the same /upload page is the right tool instead.',
    keywords: ['photo to quote', 'photo-to-quote', 'upload photos', '/upload', 'jobsite photos', 'AI identification', 'condition assessment'],
  },
  {
    id: 'spec-architect-portal-overview',
    category: 'AFS Platform Features',
    subcategory: 'Architect Portal',
    topic: 'Architect Portal — spec language, CAD details, Revit families at /architects',
    content:
      'The Architect Portal (/architects) is a dedicated hub for architects and specifiers, visually distinguished from the rest of the site with a copper accent instead of AFS\'s usual crimson. It centers on four tools: an AI Spec Writer that generates CSI Division 07 specification sections in minutes (requires an architect account); a CAD Library of DWG, DXF, and Revit family files for AFS profiles (browsable by anyone, downloads require an account); a Finish Palette of digital color chips and downloadable palettes; and the Custom Profile Library of the architect\'s own past custom designs. The portal landing page and its browsing pages (resource guides, material data, CAD/finish browsing) are open to anyone; downloading files or generating a spec section requires signing in.',
    keywords: ['architect portal', '/architects', 'CSI Division 07', 'spec writer', 'CAD library', 'Revit families', 'finish palette'],
  },
  {
    id: 'spec-architect-account',
    category: 'AFS Platform Features',
    subcategory: 'Architect Portal',
    topic: 'Architect account registration and spec-writer access',
    content:
      'Registering with an "architect" account type on AFS grants architect-level access immediately — full use of the AI Spec Writer and the rest of the architect portal is available right away, without waiting on manual review, though AFS is notified and reviews new architect accounts afterward. Firm name, AIA member number, and license state can optionally be added during registration. A customer signed in under a non-architect account who visits the spec writer instead sees a message that the feature is for architect accounts, with a way to request access from AFS directly.',
    keywords: ['architect registration', 'architect account', 'AIA member number', 'architect account access', 'request architect access'],
  },
];
