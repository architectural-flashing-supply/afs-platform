import type { ProfileType } from '@/lib/utils/profile-svg';

export type StockType = 'stock' | 'fabricated' | 'special_order';

export interface CatalogCategory {
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  description: string;
  applications: string[];
  materials: string[];
  gradientClass: string;
  profileType?: ProfileType;
}

export interface CatalogDimension {
  label: string;
  value: string;
}

export interface CatalogProduct {
  slug: string;
  categorySlug: string;
  sku: string | null;
  name: string;
  description: string;
  materials: string[];
  stockType: StockType;
  leadTimeDays: number;
  rushEligible: boolean;
  profileType?: ProfileType;
  dimensions: CatalogDimension[];
  applications: string[];
}

export interface Finish {
  name: string;
  hex: string;
  isStandard: boolean;
}

export const ALL_MATERIALS = [
  'Galvanized Steel',
  'Galvanized Galvalume',
  'Copper',
  'Lead Coated Copper',
  'Anodized Aluminum',
  'Stainless Steel',
  'Zinc',
  'Kynar 500 (Painted Steel)',
  'Vintage Steel',
] as const;

// Placeholder availability mapping — real stock status per material is pending
// supplier data (see CLAUDE.md Data Blockers). Used to drive AI material guidance.
export const MATERIAL_STOCK_STATUS: Record<string, StockType> = {
  'Galvanized Steel': 'stock',
  'Galvanized Galvalume': 'fabricated',
  'Copper': 'fabricated',
  'Lead Coated Copper': 'special_order',
  'Anodized Aluminum': 'stock',
  'Stainless Steel': 'fabricated',
  'Zinc': 'special_order',
  'Kynar 500 (Painted Steel)': 'fabricated',
  'Vintage Steel': 'special_order',
};

export interface Accessory {
  name: string;
  category: string;
}

export const ACCESSORIES: Accessory[] = [
  { name: 'Butyl Sealant Tape', category: 'sealant' },
  { name: 'Stainless Steel Fasteners', category: 'fastener' },
  { name: 'Concealed Cleat System', category: 'cleat' },
  { name: 'Copper Rivets', category: 'fastener' },
  { name: 'Termination Bar', category: 'trim' },
  { name: 'Splice Plates', category: 'trim' },
  { name: 'Underlayment / Slip Sheet', category: 'membrane' },
];

export const GAUGES_BY_MATERIAL: Record<string, string[]> = {
  'Galvanized Steel':           ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Galvanized Galvalume':       ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Copper':                     ['16 oz', '20 oz'],
  'Lead Coated Copper':         ['16 oz', '18 ga'],
  'Anodized Aluminum':          ['0.032"', '0.040"', '0.050"', '0.063"', '18 ga'],
  'Stainless Steel':            ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Zinc':                       ['0.7mm', '0.8mm', '1.0mm', '1.5mm'],
  'Kynar 500 (Painted Steel)':  ['26 ga', '24 ga', '22 ga'],
  'Vintage Steel':              ['26 ga', '24 ga'],
};

const GRADIENT_COPPER = 'from-amber-900/30 to-orange-900/20';
const GRADIENT_ALUMINUM = 'from-slate-700/30 to-slate-800/20';
const GRADIENT_GALVANIZED = 'from-zinc-700/30 to-zinc-800/20';
const GRADIENT_STAINLESS = 'from-slate-600/30 to-neutral-900/20';

export const FINISHES: Finish[] = [
  { name: 'Mill Finish',              hex: '#B8BFD0', isStandard: true },
  { name: 'Kynar 500 — Bone White',   hex: '#EDE8DD', isStandard: true },
  { name: 'Kynar 500 — Slate Gray',   hex: '#5B6470', isStandard: true },
  { name: 'Kynar 500 — Dark Bronze',  hex: '#4A3728', isStandard: true },
  { name: 'Copper Natural',           hex: '#B87333', isStandard: true },
  { name: 'Custom Color Match',       hex: '#C0001A', isStandard: false },
];

export const CATEGORIES: CatalogCategory[] = [
  {
    slug: 'roofing',
    name: 'Roofing',
    tagline: 'Ridge, hip, valley, and roof-to-wall flashing',
    shortDescription:
      'Custom fabricated roofing components — ridge caps, valley flashing, and roof-to-wall transitions built to shed water on any roof system.',
    description:
      "AFS fabricates the full range of roofing sheet metal — ridge caps, hip and valley flashing, roof-to-wall step flashing, drip edge, and gravel stop — in copper, aluminum, galvanized steel, stainless, and Galvalume. Every piece is built to the exact pitch, overhang, and profile of your project, not pulled from a stock bin.",
    applications: [
      'Standing seam roofing',
      'Shingle and tile roof transitions',
      'Low-slope roof edges',
      'Roof-to-wall intersections',
    ],
    materials: ['Galvanized Steel', 'Galvanized Galvalume', 'Copper', 'Anodized Aluminum', 'Stainless Steel'],
    gradientClass: GRADIENT_GALVANIZED,
  },
  {
    slug: 'scuppers',
    name: 'Scuppers',
    tagline: 'Through-wall and overflow drainage scuppers',
    shortDescription:
      'Through-wall and overflow scuppers fabricated to your exact wall thickness and opening size, keeping parapet drainage watertight.',
    description:
      "Scuppers are one of the most failure-prone details on a low-slope roof when they aren't fabricated to the exact wall assembly. AFS builds through-wall and overflow scuppers to your parapet thickness, opening dimensions, and liner requirements — soldered or welded seams, formed to integrate cleanly with your roofing membrane.",
    applications: [
      'Parapet wall drainage',
      'Overflow / secondary drainage',
      'Built-up and single-ply roof systems',
    ],
    materials: ['Copper', 'Lead Coated Copper', 'Anodized Aluminum', 'Stainless Steel'],
    gradientClass: GRADIENT_ALUMINUM,
  },
  {
    slug: 'fascia',
    name: 'Fascia',
    tagline: 'Fascia covers and trim in every profile',
    shortDescription:
      'Fabricated fascia covers and trim finished to match your roofing and wall systems for a clean, continuous building edge.',
    description:
      "Fascia is the edge everyone sees. AFS fabricates fascia covers, sub-fascia trim, and gutter aprons in continuous lengths and every standard gauge and finish, engineered to conceal fastening and hold a straight line across the full run of the building.",
    applications: [
      'Roof edge trim',
      'Gutter apron and fascia cover systems',
      'Soffit-to-fascia transitions',
    ],
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Copper', 'Kynar 500 (Painted Steel)'],
    gradientClass: GRADIENT_ALUMINUM,
    profileType: 'fascia',
  },
  {
    slug: 'copings-cleats',
    name: 'Copings and Cleats',
    tagline: 'Coping caps and continuous cleat systems',
    shortDescription:
      'Coping caps and continuous cleats fabricated to your exact parapet dimensions, with concealed fastener systems engineered for wind uplift.',
    description:
      "Parapet coping is a wind-uplift detail as much as it is a weatherproofing detail. AFS fabricates coping caps and continuous cleats to your parapet width and slope, with concealed splice plates and cleat systems designed for wind performance requirements.",
    applications: [
      'Parapet wall coping',
      'Concealed fastener coping systems',
      'Continuous cleat and receiver systems',
    ],
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Copper', 'Stainless Steel'],
    gradientClass: GRADIENT_COPPER,
    profileType: 'coping-cap',
  },
  {
    slug: 'siding-walls',
    name: 'Siding and Walls',
    tagline: 'Metal wall panels, reveals, and siding trim',
    shortDescription:
      'Custom wall panels, reveals, and metal siding trim fabricated in every gauge and finish to complete the building envelope.',
    description:
      "From flush and reveal wall panels to corner trim and reglets, AFS fabricates the metal wall components that finish out a building envelope. Every panel and trim piece is formed to your reveal width, break dimensions, and finish specification.",
    applications: [
      'Metal wall panel systems',
      'Reveal and corner trim',
      'Reglets and control joints',
    ],
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Zinc', 'Kynar 500 (Painted Steel)'],
    gradientClass: GRADIENT_GALVANIZED,
  },
  {
    slug: 'custom-fabrications',
    name: 'Custom Fabrications',
    tagline: 'One-off and specialty sheet metal',
    shortDescription:
      "One-off and specialty fabrications built to your drawings — when a standard profile won't do, our shop builds it to spec.",
    description:
      "Not every detail fits a standard profile. AFS's shop fabricates custom one-off flashing, transitions, and specialty sheet metal components from your drawings or field measurements — the same reason contractors upload blueprints to our takeoff tool instead of guessing at a stock part.",
    applications: [
      'Non-standard transitions and terminations',
      'Architectural details outside a standard catalog',
      'Field-measured custom pieces',
    ],
    materials: [...ALL_MATERIALS],
    gradientClass: GRADIENT_STAINLESS,
  },
  {
    slug: 'windows-doors',
    name: 'Windows and Doors Flashing',
    tagline: 'Head, sill, and jamb flashing',
    shortDescription:
      'Head, sill, and jamb flashing fabricated to exact rough opening dimensions, keeping window and door assemblies weather-tight.',
    description:
      "Window and door flashing failures are a leading cause of building envelope callbacks. AFS fabricates head flashing, sill pans, and jamb flashing to your exact rough opening dimensions and wall assembly, formed with end dams and drainage details built in.",
    applications: [
      'Window head, sill, and jamb flashing',
      'Door pan flashing',
      'Storefront and curtain wall transitions',
    ],
    materials: ['Anodized Aluminum', 'Galvanized Steel', 'Stainless Steel'],
    gradientClass: GRADIENT_ALUMINUM,
  },
];

export const PRODUCTS: CatalogProduct[] = [
  {
    slug: 'ridge-cap',
    categorySlug: 'roofing',
    sku: 'AFS-RF-101',
    name: 'Ridge Cap',
    description:
      'Formed ridge cap for standing seam, shingle, and tile roof systems, break-formed to your exact roof pitch and overlap requirements.',
    materials: ['Galvanized Steel', 'Copper', 'Anodized Aluminum'],
    stockType: 'fabricated',
    leadTimeDays: 5,
    rushEligible: true,
    dimensions: [
      { label: 'Width', value: '6" – 16"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Standing seam roofing', 'Shingle and tile roof ridges'],
  },
  {
    slug: 'valley-flashing',
    categorySlug: 'roofing',
    sku: 'AFS-RF-102',
    name: 'Valley Flashing',
    description:
      'Open valley flashing formed to your roof pitch and valley width, with hemmed edges for rigidity and clean water shed.',
    materials: ['Galvanized Steel', 'Galvanized Galvalume', 'Copper'],
    stockType: 'fabricated',
    leadTimeDays: 5,
    rushEligible: true,
    dimensions: [
      { label: 'Width', value: '12" – 24"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Roof valley drainage', 'Shingle and tile roof transitions'],
  },
  {
    slug: 'through-wall-scupper',
    categorySlug: 'scuppers',
    sku: 'AFS-SC-201',
    name: 'Through-Wall Scupper',
    description:
      'Through-wall scupper formed and soldered to your parapet thickness and opening dimensions, with an integral overhang to shed water clear of the wall face.',
    materials: ['Copper', 'Anodized Aluminum', 'Stainless Steel'],
    stockType: 'fabricated',
    leadTimeDays: 7,
    rushEligible: false,
    dimensions: [
      { label: 'Opening Width', value: '4" – 12"' },
      { label: 'Wall Thickness', value: '8" – 16"' },
    ],
    applications: ['Parapet wall drainage', 'Built-up and single-ply roof systems'],
  },
  {
    slug: 'overflow-scupper',
    categorySlug: 'scuppers',
    sku: 'AFS-SC-202',
    name: 'Overflow Scupper',
    description:
      'Secondary overflow scupper set above the primary drainage line, fabricated to code-required height and opening dimensions.',
    materials: ['Copper', 'Lead Coated Copper', 'Stainless Steel'],
    stockType: 'fabricated',
    leadTimeDays: 7,
    rushEligible: false,
    dimensions: [
      { label: 'Opening Width', value: '4" – 12"' },
      { label: 'Wall Thickness', value: '8" – 16"' },
    ],
    applications: ['Overflow / secondary drainage', 'Parapet wall drainage'],
  },
  {
    slug: 'fascia-cover',
    categorySlug: 'fascia',
    sku: 'AFS-FC-301',
    name: 'Fascia Cover',
    description:
      'Continuous fascia cover with a concealed hem, formed to your sub-fascia depth and roof edge detail for a straight, clean building edge.',
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Kynar 500 (Painted Steel)'],
    stockType: 'fabricated',
    leadTimeDays: 4,
    rushEligible: true,
    profileType: 'fascia',
    dimensions: [
      { label: 'Height', value: '4" – 10"' },
      { label: 'Leg A', value: '1" – 3"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Roof edge trim', 'Soffit-to-fascia transitions'],
  },
  {
    slug: 'gutter-apron',
    categorySlug: 'fascia',
    sku: 'AFS-FC-302',
    name: 'Gutter Apron',
    description:
      'Gutter apron formed to direct roof runoff behind the gutter and onto the fascia line, preventing water intrusion behind gutter systems.',
    materials: ['Galvanized Steel', 'Anodized Aluminum'],
    stockType: 'fabricated',
    leadTimeDays: 4,
    rushEligible: true,
    dimensions: [
      { label: 'Leg A', value: '2" – 4"' },
      { label: 'Leg B', value: '2" – 4"' },
    ],
    applications: ['Gutter apron and fascia cover systems'],
  },
  {
    slug: 'coping-cap',
    categorySlug: 'copings-cleats',
    sku: 'AFS-CC-401',
    name: 'Coping Cap',
    description:
      'Parapet coping cap formed with concealed splice plates and a positive slope to the interior, engineered for wind uplift performance.',
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Copper', 'Stainless Steel'],
    stockType: 'fabricated',
    leadTimeDays: 6,
    rushEligible: true,
    profileType: 'coping-cap',
    dimensions: [
      { label: 'Width', value: '8" – 24"' },
      { label: 'Height', value: '3" – 8"' },
      { label: 'Leg A / Leg B', value: '2" – 4"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Parapet wall coping', 'Concealed fastener coping systems'],
  },
  {
    slug: 'continuous-cleat',
    categorySlug: 'copings-cleats',
    sku: 'AFS-CC-402',
    name: 'Continuous Cleat',
    description:
      'Continuous cleat and receiver system fabricated to match your coping profile, providing the mechanical hold-down for wind performance.',
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Stainless Steel'],
    stockType: 'fabricated',
    leadTimeDays: 5,
    rushEligible: true,
    dimensions: [
      { label: 'Leg A', value: '1" – 2"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Continuous cleat and receiver systems'],
  },
  {
    slug: 'wall-panel-trim',
    categorySlug: 'siding-walls',
    sku: 'AFS-SW-501',
    name: 'Wall Panel Trim',
    description:
      'Corner and edge trim for metal wall panel systems, break-formed to match reveal width and panel thickness.',
    materials: ['Galvanized Steel', 'Anodized Aluminum', 'Zinc'],
    stockType: 'fabricated',
    leadTimeDays: 6,
    rushEligible: false,
    dimensions: [
      { label: 'Leg A / Leg B', value: '2" – 6"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Metal wall panel systems'],
  },
  {
    slug: 'reveal-strip',
    categorySlug: 'siding-walls',
    sku: 'AFS-SW-502',
    name: 'Reveal Strip',
    description:
      'Reveal strip and control joint trim formed to your specified reveal width for flush and staggered wall panel systems.',
    materials: ['Anodized Aluminum', 'Zinc', 'Kynar 500 (Painted Steel)'],
    stockType: 'fabricated',
    leadTimeDays: 6,
    rushEligible: false,
    dimensions: [
      { label: 'Reveal Width', value: '0.5" – 2"' },
      { label: 'Max Length', value: '10 ft standard, cut to length' },
    ],
    applications: ['Reveal and corner trim', 'Reglets and control joints'],
  },
  {
    slug: 'custom-profile',
    categorySlug: 'custom-fabrications',
    sku: null,
    name: 'Custom Profile Fabrication',
    description:
      'A one-off profile built from your drawing, sketch, or field measurement. Submit a drawing or describe the detail — our shop builds it to spec.',
    materials: [...ALL_MATERIALS],
    stockType: 'special_order',
    leadTimeDays: 10,
    rushEligible: true,
    dimensions: [
      { label: 'Dimensions', value: 'Built to your drawing or field measurement' },
    ],
    applications: ['Non-standard transitions and terminations', 'Architectural details outside a standard catalog'],
  },
  {
    slug: 'field-measured-detail',
    categorySlug: 'custom-fabrications',
    sku: null,
    name: 'Field-Measured Detail',
    description:
      'For retrofit and remediation work where drawings do not exist, AFS fabricates from field measurements and photos submitted through the takeoff tool.',
    materials: [...ALL_MATERIALS],
    stockType: 'special_order',
    leadTimeDays: 10,
    rushEligible: true,
    dimensions: [
      { label: 'Dimensions', value: 'Built to field measurement or photo takeoff' },
    ],
    applications: ['Field-measured custom pieces'],
  },
  {
    slug: 'head-flashing',
    categorySlug: 'windows-doors',
    sku: 'AFS-WD-601',
    name: 'Head Flashing',
    description:
      'Window and door head flashing with an integral drip edge and end dams, formed to your rough opening width and wall assembly depth.',
    materials: ['Anodized Aluminum', 'Galvanized Steel', 'Stainless Steel'],
    stockType: 'fabricated',
    leadTimeDays: 5,
    rushEligible: true,
    dimensions: [
      { label: 'Opening Width', value: '2 ft – 12 ft' },
      { label: 'Leg A / Leg B', value: '2" – 5"' },
    ],
    applications: ['Window head, sill, and jamb flashing', 'Storefront and curtain wall transitions'],
  },
  {
    slug: 'sill-pan-flashing',
    categorySlug: 'windows-doors',
    sku: 'AFS-WD-602',
    name: 'Sill Pan Flashing',
    description:
      'Sloped sill pan flashing with formed end dams, built to your rough opening width to direct water out and away from the wall assembly.',
    materials: ['Anodized Aluminum', 'Stainless Steel'],
    stockType: 'fabricated',
    leadTimeDays: 5,
    rushEligible: true,
    dimensions: [
      { label: 'Opening Width', value: '2 ft – 12 ft' },
      { label: 'Leg A / Leg B', value: '2" – 5"' },
    ],
    applications: ['Window head, sill, and jamb flashing', 'Door pan flashing'],
  },
];

export function getCategory(slug: string): CatalogCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getProductsByCategory(categorySlug: string): CatalogProduct[] {
  return PRODUCTS.filter((p) => p.categorySlug === categorySlug);
}

export function getProduct(categorySlug: string, slug: string): CatalogProduct | undefined {
  return PRODUCTS.find((p) => p.categorySlug === categorySlug && p.slug === slug);
}

export function gaugesForMaterials(materials: string[]): string[] {
  const set = new Set<string>();
  for (const m of materials) {
    for (const g of GAUGES_BY_MATERIAL[m] ?? []) set.add(g);
  }
  return Array.from(set);
}

export const STOCK_TYPE_LABEL: Record<StockType, string> = {
  stock: 'In Stock',
  fabricated: 'Made to Order',
  special_order: 'Special Order',
};
