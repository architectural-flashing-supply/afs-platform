export interface FaqEntry {
  q: string;
  a: string;
}

export interface FaqCategory {
  category: string;
  questions: FaqEntry[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    category: 'Company & Contact',
    questions: [
      {
        q: 'Who is Architectural Flashing Supply?',
        a: `Architectural Flashing Supply (AFS) is a precision sheet metal fabrication shop headquartered in Burnet, Texas. We custom-fabricate architectural flashing, sheet metal roofing components, gutters, coping caps, and specialty metal profiles for contractors, architects, and builders across Texas and North America. Texas-made. Nationally delivered.`,
      },
      {
        q: 'Where is AFS located?',
        a: `209 Sure Cast Drive, Burnet, TX 78611 — in the Texas Hill Country. We serve customers across Texas and deliver throughout North America.`,
      },
      {
        q: 'How do I contact AFS?',
        a: `Phone: (512) 372-4900 | General: trica@architecturalflashingsupply.com | Owner: steve@architecturalflashingsupply.com | Address: 209 Sure Cast Drive, Burnet, TX 78611`,
      },
      {
        q: 'Do you serve customers outside of Texas?',
        a: `Yes. AFS fabricates and ships custom sheet metal profiles throughout Texas and delivers across North America. Our primary service territory covers Central and South Texas, the Hill Country, Austin, San Antonio, Houston, and Dallas/Fort Worth — but we ship anywhere.`,
      },
      {
        q: 'How do I evaluate whether AFS is the right fabricator for my project?',
        a: `Ask us: what similar profiles have you fabricated, what are your current lead times, do you provide shop drawings, and how do you handle field condition issues discovered during fabrication? AFS provides shop drawings for approval on commercial projects, proactive communication on material lead times, and formal quotes based on your exact specifications — not generic pricing.`,
      },
      {
        q: 'Does AFS work with architects directly?',
        a: `Yes. AFS has a dedicated Architect Portal at /architects with specification writing assistance, profile guides, and direct quote submission. We provide material submittals and shop drawings for project close-out documentation.`,
      },
    ],
  },
  {
    category: 'Products & Profiles',
    questions: [
      {
        q: 'What is the difference between coping, flashing, and drip edge?',
        a: `These three components work together but serve different purposes. Coping covers the top of a parapet wall horizontally — it is a cap that sheds water off both sides of the wall. Flashing seals vertical transitions and joints where two surfaces meet, directing water away from penetrations. Drip edge is installed at sloped roof edges to direct water into gutters and prevent it from running back under the roofing. All three are commonly fabricated by AFS in copper, aluminum, and galvanized steel.`,
      },
      {
        q: 'What types of sheet metal profiles does AFS fabricate?',
        a: `AFS fabricates: Coping Caps, Base Flashing, Counter Flashing, Step Flashing, Valley Flashing, Drip Edge, Gravel Stops, Fascia, Gutters (K-style, box, half-round), Downspouts, Conductor Heads, Scuppers, Reglets, Z-Bar and Pitch Change profiles, Z-Closure, Hip Caps, Ridge Caps, Inside Corners, Outside Corners, Window and Door Pan Flashing, Expansion Joint Covers, Wall Panels, Sheet Metal Cleats, and Custom Profiles via FlashDraft.`,
      },
      {
        q: 'What is a coping cap and when do I need one?',
        a: `A coping cap is a sheet metal cap installed at the top of a parapet wall to protect it from water infiltration. Required on virtually every parapet wall. AFS fabricates coping caps in copper, aluminum, galvanized steel, and stainless steel with custom widths, heights, and leg lengths. The standard minimum slope is 1/8" per foot back toward the roof, with drip edges on both sides to prevent capillary action.`,
      },
      {
        q: 'What is the minimum slope required for a coping cap?',
        a: `Industry standard per SMACNA is 1/8" per foot minimum slope toward the roof side. The coping should overhang the wall face by a minimum of 3/4" to 1" on each side with a formed drip edge to break water tension and prevent water from tracking back to the wall. AFS fabricates coping caps to these requirements.`,
      },
      {
        q: 'What is a gravel stop and do I need it with a torch-down roof?',
        a: `A gravel stop is a perimeter edge metal profile that retains ballast aggregate on a roof and provides a finished edge. With torch-down (modified bitumen) roofing, gravel stops are still commonly specified at the roof perimeter to provide a clean metal termination edge and protect the membrane edge from wind uplift and UV deterioration — even without loose gravel. AFS fabricates gravel stops in all standard face heights and materials.`,
      },
      {
        q: 'What is a drip edge?',
        a: `A drip edge is an L-shaped or T-shaped metal profile installed at the eave and rake of a roof to direct water away from the fascia and into the gutter. One of the most commonly ordered profiles at AFS. Available in aluminum, galvanized, and copper.`,
      },
      {
        q: 'What is counter flashing and how does it differ from base flashing?',
        a: `Base flashing is the primary sheet metal component at the base of a wall or penetration — it integrates with the roof membrane and directs water onto the roof surface. Counter flashing overlaps the top of base flashing and is embedded into a reglet or mortar joint in the wall — it prevents water from getting behind the base flashing. Both are required for a watertight flashing assembly. AFS fabricates both components to match your field dimensions.`,
      },
      {
        q: 'What is a reglet?',
        a: `A reglet is a narrow slot or channel — either cut into masonry or formed as a surface-mounted metal extrusion — that receives the top edge of counter flashing. Surface-mounted reglets are used when cutting into existing masonry is not feasible. AFS fabricates surface-mounted reglets in aluminum and galvanized steel.`,
      },
      {
        q: 'What is a Z-bar or pitch change?',
        a: `A Z-bar (pitch change) is a Z-shaped metal profile used to transition between two different planes or offset flashing from a wall surface. Common at horizontal-to-vertical transitions, window sill terminations, and wall panel attachment. AFS fabricates Z-bars in standard and custom offsets.`,
      },
      {
        q: 'What types of cleats does AFS fabricate?',
        a: `AFS fabricates flat cleats, standing seam cleats, double-lock cleats, expansion cleats, starter cleats, and cap cleats. All cleat profiles require custom geometry — use our FlashDraft tool to draw your exact cleat profile and submit for a quote.`,
      },
      {
        q: 'Can AFS match existing flashing profiles on a renovation or historic preservation project?',
        a: `Yes. Use our Photo to Quote feature to photograph the existing condition from multiple angles, or contact trica@architecturalflashingsupply.com with photos and at least one verified dimension. Our estimators will reverse-engineer the profile and follow up with a match quote.`,
      },
      {
        q: 'What file formats does AFS accept for drawing submissions?',
        a: `AFS accepts PDF, DWG, DXF, and JPG/PNG photo submissions. Upload directly through our Design Studio at /studio. For complex custom profiles, use FlashDraft to draw geometry directly in the browser.`,
      },
      {
        q: 'Can AFS fabricate gutters?',
        a: `Yes. AFS fabricates K-style (ogee), box, and half-round gutters in aluminum, copper, and galvanized steel, to custom lengths with matching end caps, miters, outlets, and hangers.`,
      },
    ],
  },
  {
    category: 'Materials',
    questions: [
      {
        q: 'What materials does AFS work with?',
        a: `Copper (16oz, 20oz, 24oz), Aluminum (.032", .040", .050", .063"), Galvanized Steel (24ga, 22ga, 20ga, G-90), Stainless Steel (304 and 316 grades), Lead-Coated Copper, and Zinc.`,
      },
      {
        q: 'What is the difference between 16oz, 20oz, and 24oz copper?',
        a: `These designations refer to the weight of copper sheet per square foot. 16oz (.0216" thick) is the minimum standard for most architectural flashing. 20oz (.0270") is used for larger coping caps, high-traffic applications, and longer service intervals. 24oz is used for premium applications, historic restoration, and monumental projects. Heavier gauges provide greater durability and resistance to damage.`,
      },
      {
        q: 'When should I specify copper vs. aluminum flashing?',
        a: `Copper is specified for premium, long-life applications — historic buildings, high-end commercial, institutional, and where a natural patina is desired. Service life: 75-100+ years. Aluminum is specified for cost-sensitive projects, where Kynar color-matching is required, and where lighter weight is a factor. Service life: 40-60 years with proper installation. Never use copper and aluminum together — galvanic incompatibility causes accelerated aluminum corrosion.`,
      },
      {
        q: 'What is the best flashing material for coastal Texas applications?',
        a: `For coastal and near-saltwater environments (within approximately 1 mile of saltwater), specify 316 stainless steel for maximum corrosion resistance. Copper is also an excellent choice for coastal applications. Aluminum performs well when isolated from copper and steel. Standard galvanized steel is not recommended within 1 mile of saltwater without additional protective coatings. Contact AFS for material recommendations specific to your project location.`,
      },
      {
        q: 'What gauge galvanized steel should I specify?',
        a: `24-gauge G-90 galvanized steel is the minimum for most architectural flashing. 22-gauge for coping caps, gravel stops, and foot-traffic applications. Always specify G-90 zinc coating minimum for exterior applications.`,
      },
      {
        q: 'What is Kynar 500 / PVDF coating on aluminum?',
        a: `Kynar 500 is a polyvinylidene fluoride (PVDF) coating applied to aluminum sheet. It provides superior UV resistance, color retention, and chalk resistance vs. standard polyester coatings. Specified for wall panels, fascia, and any application requiring long-term color retention and color matching to building finishes. AFS fabricates in Kynar-coated aluminum — contact us for color availability.`,
      },
      {
        q: 'What is the expected service life of different flashing materials?',
        a: `Approximate service life with proper installation and maintenance: Copper 75-100+ years; Lead-Coated Copper 75-100+ years; Stainless Steel 316 50-100 years; Aluminum 40-60 years; Galvanized Steel G-90 20-40 years depending on environment; Zinc 60-80 years.`,
      },
      {
        q: 'What is lead-coated copper?',
        a: `Lead-coated copper is copper sheet with a thin terne (lead-tin alloy) coating on both faces. The coating prevents green patina development and eliminates copper staining of adjacent masonry. Commonly specified for through-wall flashing at masonry construction where copper staining of stone or brick would be objectionable.`,
      },
    ],
  },
  {
    category: 'Process & Ordering',
    questions: [
      {
        q: 'How does the AFS quote process work?',
        a: `AFS operates on a Request for Quote (RFQ) model — every project receives a custom quote based on profile geometry, material, gauge, quantity, and current material pricing. Submit your specifications through our Design Studio and our estimators will follow up with formal pricing. No prices are published online — every job is custom.`,
      },
      {
        q: 'What are the five ways to submit a quote request to AFS?',
        a: `(1) Scan to Quote — upload PDF, DWG, or DXF construction drawings; AI extracts profiles automatically. (2) Photo to Quote — photograph existing flashing in the field; AI identifies profile and material. (3) FlashDraft — draw your exact custom profile on our canvas tool, standard or custom. (4) Quick Quote — describe what you need in plain language for simple requests.`,
      },
      {
        q: 'When should I engage AFS on a project?',
        a: `As early as possible — ideally during design development or construction document phase. Early engagement allows AFS to flag material lead time concerns before they affect the construction schedule, review details for fabricability, and provide accurate budget pricing for your scope. Waiting until the project is under construction to engage a sheet metal fabricator is one of the most common scheduling mistakes on commercial projects.`,
      },
      {
        q: 'What is a realistic lead time for custom sheet metal fabrication?',
        a: `Standard profiles (drip edge, gravel stop, basic flashing) can often be fabricated within 1-2 weeks of approved shop drawings. Complex profiles, large quantities, or specialty materials (copper, stainless, specialty Kynar colors) may require 3-6 weeks. Specialty sheet goods can run 10-12 weeks in some material supply environments. Contact AFS at (512) 372-4900 for current lead time estimates on your specific scope.`,
      },
      {
        q: 'Does AFS provide shop drawings?',
        a: `Yes. AFS provides shop drawings prior to fabrication for approval on commercial projects. Shop drawings show profiles, dimensions, material, gauge, attachment details, and expansion joint locations. Contact trica@architecturalflashingsupply.com to discuss shop drawing requirements.`,
      },
      {
        q: 'What information do I need to submit a quote?',
        a: `Profile type, material, gauge/thickness, overall dimensions (width, height, leg lengths), linear footage, and quantity. For custom profiles: a dimensioned sketch or FlashDraft submission. For photo submissions: clear photos from multiple angles with at least one dimension verified in the field.`,
      },
      {
        q: 'Can I pick up my order at the AFS shop?',
        a: `Yes. Will-call pickup available at 209 Sure Cast Drive, Burnet, TX 78611. Contact trica@architecturalflashingsupply.com to schedule.`,
      },
    ],
  },
  {
    category: 'Division 7 & Technical',
    questions: [
      {
        q: 'What CSI Division covers architectural flashing?',
        a: `CSI MasterFormat Division 07 — Thermal and Moisture Protection. Key sections: 07 62 00 Sheet Metal Flashing and Trim; 07 63 00 Sheet Metal Drainage; 07 71 00 Roof Specialties (coping, gravel stop, fascia). AFS fabricates to Division 07 specifications.`,
      },
      {
        q: 'What are the standard installation requirements for sheet metal flashing?',
        a: `Industry standards: minimum 3" end laps on all sheet metal flashing; thermal expansion allowance of 1/8" per 10 feet for copper and 3/16" per 10 feet for aluminum; never sandwich dissimilar metals without isolation membrane; counter flashing minimum 4" overlap over base flashing; coping caps minimum 3/4" to 1" overhang each side with drip edges; through-wall flashing minimum 4" embed into wall with 1/4":12 slope minimum to drain.`,
      },
      {
        q: 'How much thermal expansion allowance do I need for sheet metal flashing?',
        a: `Per 10 linear feet, temperature range 0°F to 120°F: Copper 1/8"; Aluminum 3/16"; Galvanized Steel 1/10"; Stainless Steel 1/10". Provide expansion joints or slip joints at intervals not exceeding 10 feet for copper and aluminum. Failure to accommodate thermal expansion is one of the leading causes of premature flashing failure — oil-canning, fatigue cracking at seams, and fastener pullout all result from restrained thermal movement.`,
      },
      {
        q: 'What causes coping cap wind uplift failures?',
        a: `Common causes: insufficient fastening frequency; no continuous cleat at base; cleats not extending full length of coping; expansion joints too far apart allowing movement stress to concentrate at fasteners; coping face height too tall for the gauge of metal specified; and inadequate anchorage of cleats to the substrate. SMACNA provides design tables correlating face height, gauge, and required fastening for various wind exposure categories. AFS fabricates coping caps to these requirements.`,
      },
      {
        q: 'What causes sheet metal flashing to fail prematurely?',
        a: `Most common causes: end laps under 3"; no expansion allowance causing fatigue cracking; galvanic corrosion from dissimilar metals in contact; sealant used as primary water barrier without proper lapped geometry; inadequate fastening; improper slope causing ponding; and bridging movement joints without expansion provisions.`,
      },
      {
        q: 'What sealants are compatible with sheet metal flashing?',
        a: `Polyurethane and neutral-cure silicone are compatible with most metals. Never use acetoxy-cure (acid-cure) silicone on copper or lead-coated copper — the acetic acid causes corrosion. Sealant is never a primary water barrier — proper geometry and lapped profiles are always required.`,
      },
      {
        q: 'What is the SMACNA standard and should I reference it in my specifications?',
        a: `The SMACNA Architectural Sheet Metal Manual is the authoritative industry reference for flashing design, material selection, and installation practice. Specify "fabricate in accordance with SMACNA Architectural Sheet Metal Manual, current edition" in Division 07 specification sections. AFS fabricates to SMACNA standards.`,
      },
      {
        q: 'What is oil-canning and how do I prevent it?',
        a: `Oil-canning is visible waviness or buckling in flat sheet metal panels caused by internal stress — an inherent characteristic of light-gauge flat metal, not a structural defect. Minimize it by specifying heavier gauge material, adding ribs or stiffening breaks to the panel, limiting flat panel widths, and ensuring proper thermal expansion allowance. Discuss anti-oil-canning requirements with AFS during design.`,
      },
    ],
  },
  {
    category: 'Delivery & Tracking',
    questions: [
      {
        q: 'Does AFS deliver?',
        a: `Yes. AFS delivers throughout Texas and ships custom fabricated profiles across North America. When your order ships, you receive a personal tracking link by text and email.`,
      },
      {
        q: 'How does AFS delivery tracking work?',
        a: `When your order is dispatched, you receive a text message and email with a personal tracking link. The link opens a live map at /track showing your driver's real-time GPS location. You also receive a text notification when your driver is approximately 10 miles from your delivery address.`,
      },
      {
        q: 'What areas does AFS serve?',
        a: `Primary territory: Central Texas, Hill Country, Austin metro, San Antonio metro, Houston, and Dallas/Fort Worth. We ship nationwide for projects requiring AFS's specialized fabrication. Headquartered in Burnet, TX — delivering across North America.`,
      },
      {
        q: 'How is custom sheet metal packaged for shipping?',
        a: `Profiles are carefully packaged to prevent damage in transit. Long profiles are bundled and protected. Contact AFS for freight specifics on your project.`,
      },
    ],
  },
];
