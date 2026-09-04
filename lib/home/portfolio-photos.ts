// Real AFS project photography (afs-fl-034). Source: the 39 photos at
// architecturalflashingsupply.com/wp-content/uploads/2024/03/
// Architectural-Flashing-Supply-{1-39}.jpg — independently re-verified by
// HTTP request (1-39 return 200, 40 returns 404) rather than trusted from a
// prior session's claim. Copied into public/home_page_images/gallery/ as
// local static assets (afs-1.jpg .. afs-39.jpg) instead of hotlinking the
// WordPress host, so the homepage doesn't depend on that site staying up.
//
// Every photo below was individually viewed and grouped by what is actually
// depicted — there was no pre-existing category mapping anywhere in this
// repo to draw from. Photo #29 (a wood glulam arched trellis/pergola, no
// visible flashing or metal fabrication) was left out of every category —
// it doesn't clearly depict AFS's fabrication work, so it isn't used here.

export interface PortfolioPhoto {
  id: number;
  src: string;
  alt: string;
}

export const PORTFOLIO_PHOTOS: Record<number, PortfolioPhoto> = {
  1: { id: 1, src: '/home_page_images/gallery/afs-1.jpg', alt: 'Close-up of copper standing-seam roof panels meeting at a ridge, with a round copper vent boot' },
  2: { id: 2, src: '/home_page_images/gallery/afs-2.jpg', alt: 'Copper standing-seam roof transitioning into a dark metal roof section at a hip' },
  3: { id: 3, src: '/home_page_images/gallery/afs-3.jpg', alt: 'Metal wall panel cladding above a stone facade, under a wood soffit overhang' },
  4: { id: 4, src: '/home_page_images/gallery/afs-4.jpg', alt: 'Fabricated metal curb flashing around a roof access hatch, being lowered into place' },
  5: { id: 5, src: '/home_page_images/gallery/afs-5.jpg', alt: 'Underside of a wood eave with copper trim and fascia detail' },
  6: { id: 6, src: '/home_page_images/gallery/afs-6.jpg', alt: 'Copper-clad skylight curb on a standing-seam copper roof, hill-country view behind' },
  7: { id: 7, src: '/home_page_images/gallery/afs-7.jpg', alt: 'Copper flat-lock (diamond flat-seam) roof panels meeting a standing-seam ridge' },
  8: { id: 8, src: '/home_page_images/gallery/afs-8.jpg', alt: 'Copper box gutter and eave cornice detail at a building corner, with downspout' },
  9: { id: 9, src: '/home_page_images/gallery/afs-9.jpg', alt: 'Custom copper fireplace surround fabricated for a residential living room' },
  10: { id: 10, src: '/home_page_images/gallery/afs-10.jpg', alt: 'Custom copper range hood installed above a kitchen cooktop' },
  11: { id: 11, src: '/home_page_images/gallery/afs-11.jpg', alt: 'Vertical standing-seam metal wall panels on a building under construction' },
  12: { id: 12, src: '/home_page_images/gallery/afs-12.jpg', alt: 'Copper roof valley with a lead-coated copper diamond flat-seam skylight curb insert' },
  13: { id: 13, src: '/home_page_images/gallery/afs-13.jpg', alt: 'Stone wall fitted with copper conduit and downspout accents' },
  14: { id: 14, src: '/home_page_images/gallery/afs-14.jpg', alt: 'Sculptural bent-copper accent pillar set in a desert landscape entry' },
  15: { id: 15, src: '/home_page_images/gallery/afs-15.jpg', alt: 'Copper cricket (saddle) flashing built around a roof penetration on a shingle roof' },
  16: { id: 16, src: '/home_page_images/gallery/afs-16.jpg', alt: 'Custom rounded copper turret cap fabricated for a roof dormer' },
  17: { id: 17, src: '/home_page_images/gallery/afs-17.jpg', alt: 'Copper wall cladding wrapping a curved building facade around a row of windows' },
  18: { id: 18, src: '/home_page_images/gallery/afs-18.jpg', alt: 'Copper chimney cap with a latticed cupola vent' },
  19: { id: 19, src: '/home_page_images/gallery/afs-19.jpg', alt: 'Standing-seam copper pavilion roof over a wood-beamed porch, oak trees framing the view' },
  20: { id: 20, src: '/home_page_images/gallery/afs-20.jpg', alt: 'Standing-seam metal roof with custom copper chimney caps and vent stacks' },
  21: { id: 21, src: '/home_page_images/gallery/afs-21.jpg', alt: 'Close-up of a standing-seam metal roof with a fabricated vent stack cap and mesh vent' },
  22: { id: 22, src: '/home_page_images/gallery/afs-22.jpg', alt: 'Aerial close-up of a fabricated copper dome roof, Texas hill country in the distance' },
  23: { id: 23, src: '/home_page_images/gallery/afs-23.jpg', alt: 'Flat-lock roof panel installation in progress, fabrication tools laid out on the deck' },
  24: { id: 24, src: '/home_page_images/gallery/afs-24.jpg', alt: 'Close-up of painted flat-lock metal roof panels on a low-slope roof' },
  25: { id: 25, src: '/home_page_images/gallery/afs-25.jpg', alt: 'Close-up of a teal standing-seam roof valley and saddle flashing' },
  26: { id: 26, src: '/home_page_images/gallery/afs-26.jpg', alt: 'Two-story home with a full standing-seam metal roof, wide exterior view' },
  27: { id: 27, src: '/home_page_images/gallery/afs-27.jpg', alt: 'Barrel-shaped copper eyebrow window flashing set into a shingle roof' },
  28: { id: 28, src: '/home_page_images/gallery/afs-28.jpg', alt: 'Standing-seam metal roof on a brick building with round copper gable vents' },
  29: { id: 29, src: '/home_page_images/gallery/afs-29.jpg', alt: 'Wood glulam arched trellis structure (excluded — no flashing or metal fabrication visible)' },
  30: { id: 30, src: '/home_page_images/gallery/afs-30.jpg', alt: 'Custom copper range hood mounted on a decorative tiled kitchen wall' },
  31: { id: 31, src: '/home_page_images/gallery/afs-31.jpg', alt: 'Custom copper range hood, masked for finishing during installation' },
  32: { id: 32, src: '/home_page_images/gallery/afs-32.jpg', alt: 'Copper wall panel cladding on a garage corner beside a glass roll-up door' },
  33: { id: 33, src: '/home_page_images/gallery/afs-33.jpg', alt: 'Metal arch lintel flashing above an arched window, house under construction' },
  34: { id: 34, src: '/home_page_images/gallery/afs-34.jpg', alt: 'Copper arched window head flashing above three arched windows on a blue building' },
  35: { id: 35, src: '/home_page_images/gallery/afs-35.jpg', alt: 'Dark standing-seam metal wall panel surround framing a window on a brick home' },
  36: { id: 36, src: '/home_page_images/gallery/afs-36.jpg', alt: 'Corrugated metal wall siding panel beside a door and window' },
  37: { id: 37, src: '/home_page_images/gallery/afs-37.jpg', alt: 'Close-up of a metal cricket flashing being fabricated around a brick chimney' },
  38: { id: 38, src: '/home_page_images/gallery/afs-38.jpg', alt: 'Home with a full standing-seam metal roof and covered stone entry, wide exterior view' },
  39: { id: 39, src: '/home_page_images/gallery/afs-39.jpg', alt: 'Flat-lock roof panel installation in progress, hand tools on the roof deck' },
};

export interface PortfolioCategory {
  key: string;
  label: string;
  description: string;
  representativeId: number;
  photoIds: number[];
}

// Grouped from what each photo actually shows — not an inherited/assumed
// mapping. Photo #29 is intentionally omitted (see note above).
export const PORTFOLIO_CATEGORIES: PortfolioCategory[] = [
  {
    key: 'roofing',
    label: 'Standing Seam & Copper Roofing',
    description: 'Panel roofs, ridges, valleys, domes, and cricket flashing',
    representativeId: 22,
    photoIds: [1, 2, 6, 7, 12, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 37, 38, 39],
  },
  {
    key: 'wall-window',
    label: 'Wall Panels & Window Flashing',
    description: 'Metal wall cladding, siding, and window head flashing',
    representativeId: 34,
    photoIds: [3, 11, 13, 17, 27, 32, 33, 34, 35, 36],
  },
  {
    key: 'gutters',
    label: 'Gutters, Eaves & Roof Accessories',
    description: 'Box gutters, eave trim, downspouts, and hatch curbs',
    representativeId: 8,
    photoIds: [4, 5, 8],
  },
  {
    key: 'custom',
    label: 'Custom Fabrication',
    description: 'Range hoods, fireplace surrounds, and sculptural metalwork',
    representativeId: 9,
    photoIds: [9, 10, 14, 30, 31],
  },
];

// Curated 6-8 photo spread for the project gallery — deliberately varied
// subject matter (roofing, wall flashing, interior custom fab, full-house
// context, and a sculptural accent), not near-duplicates of one roof angle.
export const PORTFOLIO_GALLERY_IDS = [22, 9, 34, 19, 14, 38, 7, 30];
