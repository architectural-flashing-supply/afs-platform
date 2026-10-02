import type { KnowledgeChunk } from './types';

// AFS company/operational knowledge — contact info, capabilities,
// service area, quote process, materials stocked, Design Studio tools,
// and delivery tracking. This is descriptive/operational content, not
// pricing — CLAUDE.md's RFQ model means customers never see prices
// before a formal AFS-generated quote, and this file must not include
// any dollar amounts or cost estimates.
export const afsCompanyKnowledge: KnowledgeChunk[] = [
  {
    id: 'company-info',
    category: 'AFS Company',
    subcategory: 'Contact Info',
    topic: 'Company name, address, phone, and email contacts',
    content:
      'Architectural Flashing Supply (AFS) is located at 209 Sure Cast Drive, Burnet, TX 78611. Main phone: (512) 372-4900. General/administrative contact: Tricia — trica@architecturalflashingsupply.com, handling administration and customer coordination. Owner and President: Steve Harycki — steve@architecturalflashingsupply.com. For complex projects, technical questions, or anything beyond a standard quote request, customers should be offered a direct connection to Tricia by phone or email.',
    keywords: ['AFS address', 'AFS phone', 'AFS email', 'contact AFS', 'Burnet Texas', 'Steve Harycki', 'Tricia'],
  },
  {
    id: 'company-capabilities',
    category: 'AFS Company',
    subcategory: 'Capabilities',
    topic: 'Fabrication capabilities and machine profile library',
    content:
      'AFS specializes in custom architectural sheet metal fabrication — coping caps, base/counter/step/valley flashing, drip edge, gravel stop, gutters, downspouts, expansion joints, cleats, and fully custom profiles — in copper, aluminum, galvanized steel, stainless, and Galvalume. The shop is built around a Thalmann ZR150 CNC bending machine, which runs from a library of 911 machine bend profiles drawn from real shop job history (fabrication programs already proven on real orders), alongside 25 canonical, catalog-named standard profiles customers can order directly through FlashDraft. FlashDraft (AFS\'s custom geometry drawing tool) also lets a customer design and submit an arbitrary cross-section outside those standard profiles for quoting, checked automatically against the machine profile library for a potential exact-match fabrication program. AFS also produces shop drawings for commercial projects where a formal submittal is required.',
    keywords: ['AFS capabilities', 'custom fabrication', 'Thalmann ZR150', 'CNC bending machine', 'machine profiles', 'canonical profiles', 'shop drawings'],
  },
  {
    id: 'company-service-area',
    category: 'AFS Company',
    subcategory: 'Service Area',
    topic: 'Service area and shipping',
    content:
      'AFS\'s primary service area is Central Texas, where the shop provides the fastest turnaround and most direct project support. AFS also serves customers across Texas statewide, and ships nationwide within North America — architects, contractors, and project owners outside Texas can submit quote requests and receive fabricated flashing and sheet metal shipped to their project site anywhere in the US.',
    keywords: ['service area', 'Central Texas', 'nationwide shipping', 'delivery area', 'North America'],
  },
  {
    id: 'company-quote-process',
    category: 'AFS Company',
    subcategory: 'Quote Process',
    topic: 'RFQ-only quote process and submission methods',
    content:
      'AFS operates as a Request for Quote (RFQ) business, not a self-service e-commerce store — customers never see prices on the website before a formal AFS-generated quote is delivered to their account portal. There are four ways to submit a request: Scan to Quote (upload a PDF or scanned drawing for AI-assisted takeoff at /upload), Photo to Quote (upload photos of an existing condition or sketch for AI-assisted quoting, also at /upload), FlashDraft (design a standard or custom profile cross-section directly in the browser at /studio/draft), and Quick Quote (a simpler guided request form at /quote for customers who know generally what they need but don\'t need the drawing tools). After submission, an AFS estimator reviews the request and generates a formal quote using AFS\'s internal pricing engine; the customer reviews and approves that formal quote in their account portal, then pays — pricing is never estimated or displayed to the customer before that formal quote exists.',
    keywords: ['RFQ', 'request for quote', 'quote process', 'Scan to Quote', 'Photo to Quote', 'FlashDraft', 'Quick Quote', 'no pricing', 'formal quote'],
  },
  {
    id: 'company-materials-stocked',
    category: 'AFS Company',
    subcategory: 'Materials',
    topic: 'Materials stocked and fabricated',
    content:
      'AFS fabricates in five core architectural sheet metal materials: copper, aluminum, galvanized steel, stainless steel, and lead-coated copper — see the Materials knowledge base for full detail on gauges, coatings, patina behavior, and compatibility for each. Galvalume-coated steel is also available as a material option across most profiles, offering improved corrosion resistance over standard galvanized coating.',
    keywords: ['materials stocked', 'copper', 'aluminum', 'galvanized', 'stainless', 'lead-coated copper', 'Galvalume'],
  },
  {
    id: 'company-design-studio-tools',
    category: 'AFS Company',
    subcategory: 'Design Studio',
    topic: 'Design Studio hub and its tools',
    content:
      'AFS\'s Design Studio (/studio) is the hub page linking to all of AFS\'s quote-request and design tools: /studio/draft (FlashDraft) for drawing a standard or fully custom profile cross-section, complete with hem details and a 2D/3D preview, checked against AFS\'s machine profile library; /upload for submitting drawings (Scan to Quote) or photos (Photo to Quote) for AI-assisted takeoff and quoting; and /quote for a simpler Quick Quote request when a customer knows roughly what they need without using FlashDraft. /studio/library is a browsable library of AFS\'s public machine bend profiles, searchable by category, blank width, and bend count, which can be loaded directly into FlashDraft as a starting point.',
    keywords: ['Design Studio', '/studio', '/studio/draft', '/upload', '/quote', '/studio/library', 'quote tools'],
  },
  {
    id: 'company-delivery-tracking',
    category: 'AFS Company',
    subcategory: 'Delivery',
    topic: 'Delivery tracking and notifications',
    content:
      'Customers can track their order\'s delivery in real time at /track, which shows live GPS location once the order is out for delivery. Customers with SMS notifications enabled receive a text alert when the delivery vehicle is within approximately 10 miles of the delivery address, giving advance notice before arrival. AFS\'s shop coordinates (used as the delivery-tracking origin point) are approximately 30.737075730063307, -98.23321342395246, corresponding to the Burnet, TX facility.',
    keywords: ['delivery tracking', '/track', 'GPS tracking', 'SMS notification', 'delivery alert', 'shop coordinates'],
  },
];
