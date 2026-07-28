'use client';

import { useEffect, useMemo, useState } from 'react';

interface Resource {
  id: string;
  category: string;
  title: string;
  description: string;
  url: string;
  logo?: string; // placeholder for future logo image
}

const RESOURCES: Resource[] = [
  // Industry Standards & Manuals
  {
    id: 'smacna-architectural-sheet-metal-manual',
    category: 'Industry Standards & Manuals',
    title: 'SMACNA Architectural Sheet Metal Manual',
    description:
      "The definitive industry reference for architectural sheet metal design, material selection, and installation practice. Covers every flashing profile, seam type, expansion provision, and material specification. Required reading for any Division 07 specifier or sheet metal fabricator. Referenced in specifications as 'fabricate per SMACNA Architectural Sheet Metal Manual, current edition.'",
    url: 'https://www.smacna.org/store/technical-resources',
  },
  {
    id: 'nrca-roofing-manual-architectural-metal-flashing',
    category: 'Industry Standards & Manuals',
    title: 'NRCA Roofing Manual: Architectural Metal Flashing',
    description:
      'National Roofing Contractors Association manual covering architectural metal flashing and condensation control. Provides installation details, material guidance, and best practices for metal flashing integration with roofing systems. The 2022 edition covers copper, aluminum, galvanized, and stainless flashing applications.',
    url: 'https://www.nrca.net/technical/manuals',
  },
  {
    id: 'ansi-spri-fm-4435-es-1-wind-design-standard',
    category: 'Industry Standards & Manuals',
    title: 'ANSI/SPRI/FM 4435 ES-1 Wind Design Standard',
    description:
      'The definitive wind uplift testing and design standard for roof edge metal systems including coping caps, gravel stops, fascia, and drip edge. Required for code-compliant commercial roofing edge metal specifications. Defines testing methodology and minimum performance requirements by wind zone.',
    url: 'https://www.spri.org/resources/',
  },
  {
    id: 'fm-global-fm-4435-roof-edge-metal-approvals',
    category: 'Industry Standards & Manuals',
    title: 'FM Global FM 4435 Roof Edge Metal Approvals',
    description:
      'Factory Mutual approval listings for roof edge metal systems. FM-approved edge metals are required on FM-insured buildings. Covers coping, gravel stop, fascia, and drip edge assemblies tested for wind uplift resistance.',
    url: 'https://www.fmglobal.com/research-and-resources/tools-and-resources/fm-approvals',
  },
  {
    id: 'copper-development-association-architectural-manual',
    category: 'Industry Standards & Manuals',
    title: 'Copper Development Association Architectural Manual',
    description:
      'Comprehensive technical manual for architectural copper applications including roofing, flashing, gutters, and cladding. Covers soldering techniques, expansion provisions, seam design, patina development, and compatibility with other materials. Freely available at copper.org.',
    url: 'https://www.copper.org/applications/architecture/arch_dhb/',
  },
  {
    id: 'aluminum-association-aluminum-in-architecture',
    category: 'Industry Standards & Manuals',
    title: 'Aluminum Association — Aluminum in Architecture',
    description:
      'Technical resources for aluminum use in architectural applications including sheet metal, panels, and extrusions. Covers alloy selection, finish specifications (Kynar/PVDF per AAMA 2605), thermal properties, and installation guidance.',
    url: 'https://www.aluminum.org/aluminum-advantage/building-construction',
  },

  // ASTM Material Specifications
  {
    id: 'astm-b370-copper-sheet-and-strip',
    category: 'ASTM Material Specifications',
    title: 'ASTM B370 — Copper Sheet and Strip for Building Construction',
    description:
      'The standard specification for copper sheet used in architectural applications including flashing, roofing, and gutters. Defines temper designations, thickness tolerances, and mechanical properties for 16oz, 20oz, and 24oz copper. Essential reference for copper flashing specifications.',
    url: 'https://www.astm.org/b0370-12r18.html',
  },
  {
    id: 'astm-b209-aluminum-sheet-and-plate',
    category: 'ASTM Material Specifications',
    title: 'ASTM B209 — Aluminum Sheet and Plate',
    description:
      'Standard specification for aluminum sheet used in architectural flashing and wall panels. Covers alloy and temper designations including 3003-H14 (standard architectural alloy), thickness tolerances, and mechanical properties. Reference for aluminum flashing gauge specifications.',
    url: 'https://www.astm.org/b0209-14.html',
  },
  {
    id: 'astm-a653-galvanized-steel-sheet',
    category: 'ASTM Material Specifications',
    title: 'ASTM A653 — Galvanized Steel Sheet (Hot-Dip)',
    description:
      'Standard specification for hot-dip zinc-coated (galvanized) steel sheet. Defines G-90 coating designation (minimum 0.90 oz/sq ft zinc coating) required for exterior architectural applications. Covers 24ga, 22ga, and 20ga commonly used in architectural flashing.',
    url: 'https://www.astm.org/a0653_a0653m-23.html',
  },
  {
    id: 'astm-a240-stainless-steel-sheet-and-strip',
    category: 'ASTM Material Specifications',
    title: 'ASTM A240 — Stainless Steel Sheet and Strip',
    description:
      'Standard specification for chromium and chromium-nickel stainless steel sheet used in architectural applications. Covers 304 and 316 grades — 316 contains molybdenum for superior chloride corrosion resistance required in coastal environments. Reference for stainless flashing specifications.',
    url: 'https://www.astm.org/a0240_a0240m-23a.html',
  },
  {
    id: 'astm-a792-galvalume-steel-sheet',
    category: 'ASTM Material Specifications',
    title: 'ASTM A792 — Galvalume Steel Sheet',
    description:
      'Standard specification for steel sheet coated with 55% aluminum-zinc alloy (Galvalume/AZ55). Provides superior corrosion resistance vs standard galvanized for roofing and flashing applications. Commonly specified for metal roofing panels and trim.',
    url: 'https://www.astm.org/a0792_a0792m-23.html',
  },
  {
    id: 'aama-2605-fluoropolymer-coatings',
    category: 'ASTM Material Specifications',
    title: 'AAMA 2605 — Voluntary Specification for Fluoropolymer Coatings',
    description:
      'American Architectural Manufacturers Association standard for 70% PVDF (Kynar 500/Hylar 5000) fluoropolymer coatings on aluminum. Required specification for color-coated aluminum flashing, wall panels, and fascia where long-term color retention and chalk resistance are specified.',
    url: 'https://www.aamanet.org/publication/aama-2605-23/',
  },

  // Building Codes & Regulations
  {
    id: 'ibc-flashing-requirements',
    category: 'Building Codes & Regulations',
    title: 'International Building Code (IBC) — Flashing Requirements',
    description:
      'The model building code adopted by most US jurisdictions. Chapter 14 covers exterior wall flashing requirements including through-wall flashing, window and door flashing, and penetration flashing. Essential reference for minimum code-required flashing scope on commercial construction.',
    url: 'https://codes.iccsafe.org/',
  },
  {
    id: 'irc-flashing-requirements',
    category: 'Building Codes & Regulations',
    title: 'International Residential Code (IRC) — Flashing Requirements',
    description:
      'Model residential building code covering flashing requirements for one- and two-family dwellings. Section R903 covers roof flashing; R703 covers wall flashing at windows, doors, and penetrations. Widely adopted by Texas jurisdictions.',
    url: 'https://codes.iccsafe.org/',
  },
  {
    id: 'asce-7-minimum-design-loads',
    category: 'Building Codes & Regulations',
    title: 'ASCE 7 — Minimum Design Loads for Buildings',
    description:
      'The structural engineering standard that establishes wind load requirements used to design coping caps, gravel stops, and other roof edge metals for wind uplift resistance. Wind speed maps in ASCE 7 form the basis for SPRI ES-1 wind zone selection.',
    url: 'https://www.asce.org/publications-and-news/asce-7',
  },
  {
    id: 'tdi-windstorm-requirements',
    category: 'Building Codes & Regulations',
    title: 'Texas Department of Insurance — Windstorm Requirements',
    description:
      'TDI windstorm inspection and compliance requirements for the Texas Gulf Coast and designated catastrophe areas. Sheet metal flashing on TDI-regulated construction must comply with windstorm standards. Critical reference for coastal Texas projects.',
    url: 'https://www.tdi.texas.gov/wind/',
  },
  {
    id: 'tdlr-roofing',
    category: 'Building Codes & Regulations',
    title: 'Texas Department of Licensing and Regulation — Roofing',
    description:
      'TDLR licensing requirements for roofing contractors in Texas. Includes continuing education requirements and contractor lookup. Reference for verifying contractor credentials on projects specifying AFS-fabricated flashing.',
    url: 'https://www.tdlr.texas.gov/roofing/',
  },

  // Professional Organizations
  {
    id: 'smacna-org',
    category: 'Professional Organizations',
    title: 'SMACNA — Sheet Metal and Air Conditioning Contractors National Association',
    description:
      'The primary trade association for union sheet metal contractors. SMACNA publishes the Architectural Sheet Metal Manual and numerous other technical references. Member contractors and fabricators adhere to SMACNA quality and installation standards.',
    url: 'https://www.smacna.org',
  },
  {
    id: 'nrca-org',
    category: 'Professional Organizations',
    title: 'NRCA — National Roofing Contractors Association',
    description:
      'The national trade association for roofing contractors. Publishes the NRCA Roofing Manual series, advocates for the roofing industry, and provides technical education. The NRCA Roofing Manual is a companion reference to SMACNA for flashing and sheet metal work.',
    url: 'https://www.nrca.net',
  },
  {
    id: 'spri-org',
    category: 'Professional Organizations',
    title: 'SPRI — Single Ply Roofing Industry',
    description:
      'Trade association representing manufacturers of membrane roofing products and components. Publishes the ANSI/SPRI ES-1 wind design standard for roof edge metals. Critical organization for specifiers of coping caps, gravel stops, and fascia on commercial roofing projects.',
    url: 'https://www.spri.org',
  },
  {
    id: 'metal-construction-association',
    category: 'Professional Organizations',
    title: 'Metal Construction Association (MCA)',
    description:
      'Trade association for the metal construction industry including metal roofing, wall panels, and architectural sheet metal. Publishes technical guides on metal panel systems, coatings, and sustainability. Resource for specifiers of metal wall panels and standing seam roofing.',
    url: 'https://www.metalconstruction.org',
  },
  {
    id: 'aia-org',
    category: 'Professional Organizations',
    title: 'American Institute of Architects (AIA)',
    description:
      'The national professional organization for licensed architects. AIA MasterSpec includes Division 07 specification sections for sheet metal flashing and trim (076200) used as the basis for project specifications. AIA contract documents are the standard for architectural services.',
    url: 'https://www.aia.org',
  },
  {
    id: 'csi-resources',
    category: 'Professional Organizations',
    title: 'Construction Specifications Institute (CSI)',
    description:
      "CSI maintains MasterFormat, the standard filing system for construction specifications and cost data. Division 07 — Thermal and Moisture Protection is the CSI division covering all architectural flashing and sheet metal work. CSI's SectionFormat and PageFormat guide specification writing.",
    url: 'https://www.csiresources.org',
  },

  // Specification & Product Resources
  {
    id: 'arcat-division-07-product-library',
    category: 'Specification & Product Resources',
    title: 'ARCAT — Division 07 Product Library',
    description:
      'Free online library of manufacturer CAD drawings, BIM files, specifications, and product data for Division 07 products including sheet metal flashing, coping, gravel stops, and edge metals. Architects use ARCAT to source product data and download manufacturer specifications.',
    url: 'https://www.arcat.com/content-type/product/thermal-and-moisture-protection-07/flashing-and-sheet-metal-076000',
  },
  {
    id: 'speclink-division-07-sections',
    category: 'Specification & Product Resources',
    title: 'SpecLink — Division 07 Specification Sections',
    description:
      'BSD SpecLink is a master guide specification system used by architects to create project specifications. Division 07 sections in SpecLink cover sheet metal flashing (076200), roof specialties (077100), and related work. Integration with manufacturer data allows automated updates.',
    url: 'https://www.speclink.com',
  },
  {
    id: 'copper-org-architectural-flashing-details',
    category: 'Specification & Product Resources',
    title: 'Copper.org — Architectural Flashing Details',
    description:
      "The Copper Development Association's free online architectural design handbook includes detailed drawings and specifications for copper flashing applications including coping caps, gravel stops, reglets, counter flashing, gutters, and standing seam roofing. Excellent reference for copper specification.",
    url: 'https://www.copper.org/applications/architecture/arch_dhb/arch-details/flashings_copings/',
  },
  {
    id: 'steel-roofing-institute',
    category: 'Specification & Product Resources',
    title: 'Steel Roofing Institute',
    description:
      'Technical resources and product information for steel roofing and wall panel systems. Covers standing seam, corrugated, and ribbed metal panels along with associated trim and flashing components.',
    url: 'https://www.steelroofing.com',
  },

  // Texas-Specific Resources
  {
    id: 'austin-building-criteria-manual-roofing',
    category: 'Texas-Specific Resources',
    title: 'City of Austin Building Criteria Manual — Roofing',
    description:
      "Austin's local amendments to the IBC and IRC affecting roofing and flashing requirements. Projects in the City of Austin must comply with local amendments in addition to state and model codes. Reference for AFS customers on Austin-area projects.",
    url: 'https://www.austintexas.gov/department/development-services',
  },
  {
    id: 'texas-state-library-building-codes',
    category: 'Texas-Specific Resources',
    title: 'Texas State Library — Building Codes',
    description:
      'Texas state-level building code adoption information and local jurisdiction amendments. Texas does not have a statewide building code for all construction — local jurisdictions adopt codes independently. Reference for determining applicable codes on Texas projects.',
    url: 'https://www.tsl.texas.gov/',
  },
  {
    id: 'osha-sheet-metal-workers-safety',
    category: 'Texas-Specific Resources',
    title: 'OSHA — Sheet Metal Workers Safety',
    description:
      'OSHA regulations applicable to sheet metal installation including fall protection, heat illness prevention (critical for Texas), and general industry standards. Reference for contractors installing AFS-fabricated flashing on job sites.',
    url: 'https://www.osha.gov/sheet-metal-workers',
  },
];

const CATEGORY_ORDER = Array.from(new Set(RESOURCES.map((r) => r.category)));

function matchesQuery(resource: Resource, term: string): boolean {
  if (!term) return true;
  const haystack = `${resource.title} ${resource.description} ${resource.category}`.toLowerCase();
  return haystack.includes(term);
}

function ExternalLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-5 hover:border-afs-crimson transition-colors flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-label uppercase tracking-wider text-afs-crimson">
          {resource.category}
        </span>
        <div className="w-12 h-12 shrink-0 bg-afs-bg-surface rounded flex items-center justify-center text-afs-chrome-dim text-xs">
          {resource.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resource.logo} alt="" className="w-full h-full object-contain rounded" />
          ) : (
            'LOGO'
          )}
        </div>
      </div>
      <h3 className="font-label font-semibold text-afs-chrome-high text-sm mb-2">{resource.title}</h3>
      <p className="font-body text-xs text-afs-chrome-mid leading-relaxed mb-3 flex-1">
        {resource.description}
      </p>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-afs-crimson text-xs font-label hover:underline flex items-center gap-1"
      >
        View Resource
        <ExternalLinkIcon />
      </a>
    </div>
  );
}

export default function ResourcesBrowser() {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(true);

  const term = query.trim().toLowerCase();
  const isFiltering = term.length > 0;

  const filtered = useMemo(() => RESOURCES.filter((r) => matchesQuery(r, term)), [term]);

  // Simple opacity transition on the result set whenever the query changes.
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, [term]);

  const gridClass = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-300 ${
    visible ? 'opacity-100' : 'opacity-0'
  }`;

  return (
    <div className="max-w-6xl mx-auto px-6 pb-20">
      <div className="mb-4 max-w-xl mx-auto">
        <label htmlFor="resources-search" className="sr-only">
          Search resources
        </label>
        <div className="relative">
          <input
            id="resources-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources..."
            className="w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 pr-10 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-afs-chrome-dim hover:text-afs-crimson transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <p className="font-body text-xs text-afs-chrome-dim mt-2 text-center">
          Showing {filtered.length} of {RESOURCES.length} resources
        </p>
      </div>

      {filtered.length === 0 && (
        <p className="font-body text-sm text-afs-chrome-mid text-center py-16">No results found</p>
      )}

      {filtered.length > 0 && isFiltering && (
        <div className={gridClass}>
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}

      {filtered.length > 0 && !isFiltering && (
        <div className="flex flex-col gap-12">
          {CATEGORY_ORDER.map((category) => (
            <section key={category}>
              <h2 className="sticky top-11 z-10 bg-afs-bg-base font-heading text-xl font-semibold text-afs-chrome-high mb-4 py-2 border-b border-afs-border">
                {category}
              </h2>
              <div className={gridClass}>
                {RESOURCES.filter((r) => r.category === category).map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
