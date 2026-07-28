import type { KnowledgeChunk } from './types';

// Material-level reference knowledge — the metals AFS fabricates with,
// their designations, coatings, compatibility rules, and expected
// service life. Mirrors and expands on the material summaries already
// baked into CHATBOT_SYSTEM_PROMPT in app/api/chat/route.ts, but at
// RAG-retrievable granularity (one chunk per material).
export const materialsKnowledge: KnowledgeChunk[] = [
  {
    id: 'mat-copper',
    category: 'Materials',
    subcategory: 'Copper',
    topic: 'Copper — gauge, patina, thermal behavior, and compatibility',
    content:
      'Copper for architectural flashing and roofing is specified by weight in ounces per square foot rather than a decimal gauge — common designations are 16oz, 20oz, and 24oz (roughly 0.0216", 0.027", and 0.0324" thick respectively). 16oz is the practical minimum for most flashing applications; 20oz and 24oz are used for roofing, coping, and higher-durability or larger-span work. Fresh copper is bright pinkish-orange and develops a natural patina over time: it darkens to a brown/chocolate tone within roughly 6–18 months of weathering, and — depending on climate and exposure — can take several years to develop the well-known green verdigris patina, which is a stable, protective oxide layer, not ongoing corrosion. Thermal coefficient of linear expansion is about 0.0000094 per °F (roughly 1/8" of movement per 10 linear feet across typical temperature swings), lower than aluminum\'s. Copper seams are commonly soldered (tin-lead solder, rosin flux only — never acid flux) rather than sealant-dependent. Copper is galvanically incompatible with aluminum and zinc — runoff from copper must not wash across those metals downstream, and direct contact must be isolated. Copper performs exceptionally well in coastal/marine environments and is the standard material for historic preservation and restoration work, prized for both its longevity and its established patina aesthetic on landmark buildings. Cost is at the higher end of AFS\'s material offerings, reflecting both raw material cost and its very long service life — architectural copper commonly reaches 75–100+ years of service life, among the longest of any roofing/flashing metal.',
    keywords: [
      'copper',
      '16oz',
      '20oz',
      '24oz',
      'copper gauge',
      'patina',
      'verdigris',
      'copper thermal expansion',
      'copper soldering',
      'copper service life',
      'historic preservation copper',
    ],
  },
  {
    id: 'mat-aluminum',
    category: 'Materials',
    subcategory: 'Aluminum',
    topic: 'Aluminum — gauge, alloy, coatings, and compatibility',
    content:
      'Aluminum for architectural sheet metal is specified by decimal gauge — common thicknesses are .032", .040", .050", and .063", with heavier gauges used for larger panels, coping, or higher wind-exposure applications where oil-canning and uplift resistance matter more. The standard architectural alloy is 3003-H14, chosen for its balance of formability (it bends cleanly without cracking) and strength. Aluminum is most commonly finished with a Kynar 500 / PVDF (polyvinylidene fluoride) coating for color and long-term UV/fade resistance — the industry benchmark, AAMA 2605, requires a minimum 70% PVDF resin content in the coating formulation for the highest performance tier. Aluminum can also be anodized (an electrochemically grown, integral oxide finish) rather than painted, for a different aesthetic and a coating that can\'t peel since it\'s part of the metal surface itself. Aluminum has a notably higher thermal coefficient of expansion than copper, galvanized steel, or stainless — roughly 3/16" of movement per 10 linear feet — so expansion joint spacing and cleat/clip engagement tolerances must be detailed more generously than for those other metals. Aluminum must be galvanically isolated from copper and steel; direct contact or copper runoff draining across aluminum will accelerate its corrosion. Its light weight is a real installation and structural-load advantage over steel or copper for large panel or fascia runs. Typical service life is 40–60 years, shorter than copper or stainless but with a significant cost advantage and excellent paintability/color range.',
    keywords: [
      'aluminum',
      '.032',
      '.040',
      '.050',
      '.063',
      'aluminum gauge',
      '3003-H14',
      'Kynar 500',
      'PVDF coating',
      'AAMA 2605',
      'anodized aluminum',
      'aluminum thermal expansion',
      'aluminum service life',
    ],
  },
  {
    id: 'mat-galvanized-galvalume',
    category: 'Materials',
    subcategory: 'Galvanized Steel',
    topic: 'Galvanized steel and Galvalume — coating, gauge, and use',
    content:
      'Galvanized steel is carbon steel coated with zinc for corrosion resistance, specified in standard sheet gauge numbers — 24ga, 22ga, and 20ga are the common architectural range, with lower gauge numbers indicating thicker material. Exterior architectural work should use a minimum G-90 zinc coating designation (90 units of zinc coating per side per the standard test basis) — lighter coating weights are intended for interior or less-exposed applications and will corrode faster outdoors. Coating can be applied by hot-dip galvanizing (the traditional, thicker, more corrosion-resistant process, typically done after fabrication) or electrogalvanizing (a thinner, more uniform electroplated coating, often applied to coil stock before fabrication) — hot-dip is generally preferred for the heaviest-duty exterior exposure. Galvalume is a related but distinct product: steel coated with an aluminum-zinc alloy (typically about 55% aluminum, 45% zinc) rather than pure zinc, which generally outperforms standard galvanizing in corrosion resistance, especially in industrial/urban atmospheres, while remaining compatible with paint systems. Any weld or cut edge on galvanized/Galvalume material breaks the protective coating locally and requires a zinc-rich touch-up coating to restore corrosion protection at that spot — an unaddressed weld area will rust preferentially even though the surrounding sheet is fully protected. Galvanized steel is commonly used for cleats, Z-bars/pitch-change trim, and other structural or largely-concealed sheet metal work where cost matters more than final appearance. Typical service life is 20–40 years, heavily dependent on the specific environment (urban/industrial and coastal exposure shorten it considerably).',
    keywords: [
      'galvanized steel',
      'G-90',
      'hot dip galvanizing',
      'electrogalvanized',
      'Galvalume',
      'zinc coating',
      'weld touch up',
      'galvanized gauge',
      'galvanized service life',
    ],
  },
  {
    id: 'mat-stainless',
    category: 'Materials',
    subcategory: 'Stainless Steel',
    topic: 'Stainless steel — grade selection, gauge, welding, and service life',
    content:
      'Stainless steel for architectural sheet metal is most commonly specified as either 304 or 316 grade. 304 is the standard general-purpose architectural grade with excellent corrosion resistance for most inland and moderate environments. 316 adds molybdenum, which significantly improves resistance to chloride-induced pitting and crevice corrosion — the standard rule of thumb is to specify 316 for any project within about one mile of saltwater or otherwise subject to heavy chloride exposure (deicing salt spray, industrial chloride environments). Typical architectural gauge range is 28ga (thinner, for trim and lighter-duty work) down to 22ga (thicker, for higher-durability or larger-span applications) — lower gauge numbers again meaning thicker material. Welding stainless requires a compatible filler rod — 316L filler is standard for welding 316 stainless (the "L" indicating low carbon content, which resists a corrosion-prone condition called sensitization that can occur at the heat-affected zone during welding). Passivation (a post-fabrication chemical treatment that removes free iron contamination and restores the full chromium-oxide passive layer at cut edges and weld areas) is an important finishing step often overlooked — without it, cut/welded stainless can show early surface rust spotting despite being the correct alloy. Austenitic stainless grades like 304 and 316 are non-magnetic (a quick field way to help distinguish them from carbon or galvanized steel, though not a substitute for a real material certification). Stainless carries a real cost premium over galvanized or aluminum but delivers the highest durability of AFS\'s common material offerings for punishing environments, with a typical service life of 50–100+ years.',
    keywords: [
      'stainless steel',
      '304 stainless',
      '316 stainless',
      'stainless grade selection',
      'coastal stainless',
      'stainless welding',
      '316L filler',
      'passivation',
      'stainless service life',
    ],
  },
  {
    id: 'mat-lead-coated-copper',
    category: 'Materials',
    subcategory: 'Lead-Coated Copper',
    topic: 'Lead-coated copper — terne coating, masonry compatibility, and use',
    content:
      'Lead-coated copper is copper sheet with a thin terne coating (a lead-tin alloy coating, historically also applied to steel for "terne metal" — see the Terne knowledge chunk for that distinction) fused to its surface. The coating serves two practical purposes: it prevents the copper from developing its normal patina, giving the material a flat, silvery-gray weathered appearance instead, and — critically for masonry work — it prevents copper runoff from staining adjacent limestone, marble, or other light-colored masonry the way bare copper runoff does over time (bare copper runoff carries dissolved copper salts that streak and stain porous stone a distinctive blue-green). This makes lead-coated copper the traditional and still-preferred choice for through-wall flashing and other masonry-adjacent flashing on light-colored stone or masonry buildings, historic and new construction alike. It retains copper\'s excellent formability, soldering characteristics, and long service life (75–100+ years, comparable to bare copper) while solving the staining problem bare copper would create in that specific application. Because it contains lead, handling requires standard lead-safe work practices (appropriate PPE, proper scrap/waste handling) during fabrication and installation.',
    keywords: [
      'lead coated copper',
      'terne coating',
      'through wall flashing material',
      'masonry staining',
      'limestone staining',
      'lead safe handling',
      'lead coated copper service life',
    ],
  },
  {
    id: 'mat-zinc',
    category: 'Materials',
    subcategory: 'Zinc',
    topic: 'Zinc — gauge, patina, and compatibility',
    content:
      'Zinc for architectural sheet metal is commonly used in thicknesses from about .027" to .040". It develops a natural, self-healing zinc oxide/zinc carbonate patina — a matte blue-gray surface layer that protects the metal beneath and, if scratched, will re-form over time. Zinc has long been a standard roofing and flashing material in Europe (particularly France, Germany, and the Benelux countries) and has been a steadily growing specification choice in the US market over the past couple of decades as designers seek its distinctive matte finish and long service life. Like aluminum, zinc is galvanically incompatible with copper — copper runoff draining across zinc will accelerate its corrosion, so zinc should never be installed downstream of copper roofing or flashing without isolation. Typical service life is 60–80 years, sitting between aluminum/galvanized and copper/stainless in AFS\'s durability range.',
    keywords: [
      'zinc',
      'zinc gauge',
      'zinc patina',
      'zinc oxide',
      'zinc carbonate',
      'European roofing standard',
      'zinc copper incompatibility',
      'zinc service life',
    ],
  },
  {
    id: 'mat-terne',
    category: 'Materials',
    subcategory: 'Terne',
    topic: 'Terne and terne-coated stainless — historical and modern use',
    content:
      'Terne historically referred to steel sheet coated with a lead-tin alloy, a traditional standing seam roofing material widely used in the 18th–20th centuries on historic American buildings (including many landmark and government structures) for its combination of good corrosion resistance, solderability, and paintability. Modern "terne" as specified today is almost always terne-coated stainless steel (TCS) — a stainless steel substrate (rather than plain carbon steel) coated with the traditional lead-tin alloy finish, combining stainless\'s underlying corrosion resistance and longevity with terne\'s historic matte-gray appearance and solderability, making it a common choice for historic restoration projects that need to match an original terne roof\'s appearance without terne\'s original substrate durability limitations. It remains most associated with traditional standing seam roofing applications, particularly on restoration and preservation work where matching a building\'s historic roofing appearance is a project requirement.',
    keywords: [
      'terne',
      'terne coated stainless',
      'TCS',
      'lead tin coating',
      'historic terne roofing',
      'restoration roofing material',
    ],
  },
];
