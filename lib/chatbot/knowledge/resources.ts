import type { KnowledgeChunk } from './types';

// Industry standards, associations, and reference documents relevant to
// architectural sheet metal work — for grounding the chatbot when a
// customer or architect asks "what standard covers X" or "how do I
// specify Y" type questions.
export const resourcesKnowledge: KnowledgeChunk[] = [
  {
    id: 'resource-smacna',
    category: 'Industry Resources',
    subcategory: 'Associations',
    topic: 'SMACNA — Sheet Metal and Air Conditioning Contractors\' National Association',
    content:
      'SMACNA (Sheet Metal and Air Conditioning Contractors\' National Association) publishes the Architectural Sheet Metal Manual, the primary industry reference for architectural sheet metal design and installation practice in North America — covering gauge/gauge-by-application tables, wind load and uplift design guidance, seam types, expansion joint spacing, gutter/downspout sizing, and standard details for flashing, coping, gravel stops, and roof accessories. Architects and specifiers commonly reference SMACNA details directly in Division 07 specification sections ("per SMACNA Architectural Sheet Metal Manual, latest edition") to establish baseline design and fabrication standards without redrawing every detail from scratch. Website: smacna.org.',
    keywords: ['SMACNA', 'Architectural Sheet Metal Manual', 'sheet metal standard', 'SMACNA details'],
  },
  {
    id: 'resource-nrca',
    category: 'Industry Resources',
    subcategory: 'Associations',
    topic: 'NRCA — National Roofing Contractors Association',
    content:
      'NRCA (National Roofing Contractors Association) publishes the NRCA Roofing Manual, a multi-volume reference covering steep-slope and low-slope roofing systems, roof edge and flashing details, and industry best practices for installation and design — a companion reference to SMACNA\'s sheet metal-focused manual, with more emphasis on the full roofing system (membrane, insulation, deck) rather than sheet metal fabrication specifically. Website: nrca.net.',
    keywords: ['NRCA', 'NRCA Roofing Manual', 'roofing standard', 'roofing best practices'],
  },
  {
    id: 'resource-spri',
    category: 'Industry Resources',
    subcategory: 'Associations',
    topic: 'SPRI — roof edge metal standards',
    content:
      'SPRI (originally the Single Ply Roofing Industry association, now covering a broader range of roofing products) develops and publishes standards specifically for roof edge systems, including wind uplift testing protocols for edge metal (gravel stops, copings, fascia). SPRI\'s standards are widely referenced in commercial roofing specifications and building codes as the basis for requiring tested, rated roof edge assemblies rather than unrated field-built details. Website: spri.org.',
    keywords: ['SPRI', 'roof edge standard', 'edge metal standard'],
  },
  {
    id: 'resource-ansi-spri-es1',
    category: 'Industry Resources',
    subcategory: 'Standards',
    topic: 'ANSI/SPRI ES-1 — wind uplift standard for roof edge metals',
    content:
      'ANSI/SPRI ES-1 is the recognized American National Standard test method and design criteria for wind design of low-slope roof edge systems — coping, gravel stops, and similar roof edge metal. It establishes a physical uplift test methodology (simulating wind loads pulling upward and outward on the edge metal) and pass/fail criteria that an edge metal assembly (including its specific cleat, fastener, and nailer configuration) must meet for a given wind pressure rating. Many building codes and commercial roofing specifications require roof edge metal to be ES-1 tested and rated for the project\'s calculated wind pressure (per ASCE 7) rather than accepting an unrated, ad hoc detail — when specifying, reference the required wind pressure/zone and require ES-1 test data for the proposed edge metal assembly.',
    keywords: ['ANSI SPRI ES-1', 'ES-1', 'wind uplift standard', 'roof edge wind testing', 'edge metal rating'],
  },
  {
    id: 'resource-fm-4435',
    category: 'Industry Resources',
    subcategory: 'Standards',
    topic: 'FM 4435 — Factory Mutual roof edge metal approval',
    content:
      'FM 4435 is Factory Mutual\'s (FM Global\'s) approval standard for roof edge metal systems, used as an alternative or supplement to ANSI/SPRI ES-1 on projects carrying FM Global insurance or where the project specification specifically requires FM-approved roof edge assemblies. FM-approved products appear in FM Global\'s Approval Guide as having passed FM\'s own testing and quality-oversight program for the specific assembly configuration tested.',
    keywords: ['FM 4435', 'Factory Mutual', 'FM approved roof edge', 'FM Global'],
  },
  {
    id: 'resource-astm-standards',
    category: 'Industry Resources',
    subcategory: 'Standards',
    topic: 'ASTM material standards for sheet metal',
    content:
      'Several ASTM standards govern the base material properties of sheet metal used in architectural flashing and roofing, and are commonly cited directly in specifications to define acceptable material sourcing and quality: ASTM A653 covers steel sheet, zinc-coated (galvanized) or zinc-iron alloy-coated by the hot-dip process — the base standard for galvanized architectural sheet steel. ASTM B370 covers copper sheet and strip for building construction, defining temper, thickness tolerance, and quality requirements for architectural copper. ASTM B209 covers aluminum and aluminum-alloy sheet and plate, defining alloy, temper, and dimensional requirements for architectural aluminum. ASTM A240 covers chromium and chromium-nickel stainless steel plate, sheet, and strip for pressure vessels and general applications, commonly referenced for architectural stainless sheet material quality as well.',
    keywords: ['ASTM A653', 'ASTM B370', 'ASTM B209', 'ASTM A240', 'ASTM standards', 'material standard', 'sheet metal ASTM'],
  },
  {
    id: 'resource-icc-ibc',
    category: 'Industry Resources',
    subcategory: 'Building Code',
    topic: 'ICC/IBC — building code flashing requirements',
    content:
      'The International Code Council (ICC) publishes the International Building Code (IBC), adopted (often with local amendments) as the governing building code in most US jurisdictions. The IBC mandates flashing at specific building envelope conditions — wall openings (windows, doors), roof-to-wall intersections, roof penetrations, and other locations where water intrusion risk requires a positive drainage detail — as a baseline legal requirement, independent of any project-specific specification. Flashing requirements in the IBC are generally performance-based (requiring flashing "to prevent water intrusion") rather than prescriptive about material or exact detail, which is why industry references like SMACNA and NRCA are relied on to fill in the actual design detail that satisfies the code\'s performance intent.',
    keywords: ['ICC', 'IBC', 'International Building Code', 'building code flashing requirement', 'code mandated flashing'],
  },
  {
    id: 'resource-aama-2605',
    category: 'Industry Resources',
    subcategory: 'Standards',
    topic: 'AAMA 2605 — fluoropolymer coating standard',
    content:
      'AAMA 2605 (American Architectural Manufacturers Association specification 2605) is the highest-performance tier of AAMA\'s coating standards for architectural aluminum, covering superior-performing organic coatings on aluminum extrusions and panels — most commonly associated with Kynar 500/PVDF fluoropolymer finishes. It requires a minimum 70% PVDF resin content in the coating and sets rigorous test requirements for color retention, chalk resistance, and film integrity under extended weathering exposure (south Florida exposure testing is a common benchmark). Specifying "AAMA 2605-compliant" finish is the standard way to require true high-performance PVDF coating rather than a lower-tier or generic painted finish.',
    keywords: ['AAMA 2605', 'PVDF coating standard', 'Kynar 500 standard', 'fluoropolymer coating', 'coating specification'],
  },
  {
    id: 'resource-csi-masterformat-div07',
    category: 'Industry Resources',
    subcategory: 'Specification Format',
    topic: 'CSI MasterFormat Division 07 — section breakdown',
    content:
      'CSI (Construction Specifications Institute) MasterFormat Division 07 — Thermal and Moisture Protection — organizes the specification sections most relevant to AFS\'s scope of work: 07 60 00 Flashing and Sheet Metal (with subsections 07 61 00 Sheet Metal Roofing, 07 62 00 Sheet Metal Flashing and Trim, 07 63 00 Sheet Metal Drainage, 07 65 00 Flexible Flashing, and 07 66 00 Sheet Metal Wall Panels), 07 71 00 Roof Specialties (coping, gravel stops, fascia), 07 72 00 Roof Accessories (expansion joints, curbs), and 07 90 00 Joint Protection (sealants, joint design). Architects writing a project manual reference these section numbers to organize AFS\'s scope alongside membrane roofing (07 50 00), insulation (07 20 00), and other Division 07 work — knowing the correct section number helps when discussing where AFS\'s product fits into a larger specification.',
    keywords: ['CSI MasterFormat', 'Division 07', 'specification section', 'MasterFormat section numbers', 'spec organization'],
  },
];
