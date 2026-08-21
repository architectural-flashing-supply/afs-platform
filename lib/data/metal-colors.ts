/**
 * Metal color chart data, extracted from the two source PDFs in
 * `public/Metal Color Charts/`:
 *   - McElroy Shades of Distinction Roof and Wall Panels.pdf
 *   - PAC CLAD Color Guide-2025.pdf
 *
 * THE NAME IS THE SOURCE OF TRUTH FOR FABRICATION AND ORDERING.
 * `hex` values are display-only approximations sampled from rendered swatch
 * images (dominant/median color per swatch) — they are NOT fabrication
 * specifications, NOT a substitute for a physical color chip, and several
 * are best-effort approximations of textured/metallic/wood-grain finishes
 * (e.g. Galvalume Plus, Cor-Ten AZP Raw, Weathered Steel, Anodic Clear,
 * Silversmith, Silver, Weathered Zinc, the Timber Series) that do not
 * reduce cleanly to one flat color. Always order and fabricate from the
 * printed color NAME, confirmed against a physical chart/chip — never from
 * the hex value here.
 *
 * afs-cv-001: names extracted directly from each PDF's color chart pages
 * and IMPLEMENTED/UNCONFIRMED pending Reid's spot-check of every name
 * against the two physical charts (see STATE_OF_THE_BUILD.md).
 */

export interface MetalColor {
  name: string;
  hex: string;
}

/** McElroy "Shades of Distinction" Metal Roof and Wall Panels — 18 colors. */
export const mcelroy: MetalColor[] = [
  { name: 'Brite White / Regal White', hex: '#DDE3E5' },
  { name: 'Roman Blue', hex: '#496479' },
  { name: 'Clay', hex: '#938B80' },
  { name: 'Ivory', hex: '#ECD2B9' },
  { name: 'Surrey Beige', hex: '#A89584' },
  { name: 'Patrician Bronze', hex: '#423326' },
  { name: 'Ash Gray', hex: '#A19C99' },
  { name: 'Light Stone', hex: '#C0B5A3' },
  { name: 'Autumn Red', hex: '#7D231B' },
  { name: 'Matte Black', hex: '#1E2028' },
  { name: 'Tudor Brown', hex: '#4D342F' },
  { name: 'Charcoal', hex: '#535154' },
  { name: 'Terratone', hex: '#5E514B' },
  { name: 'Evergreen', hex: '#324933' },
  { name: 'Galvalume Plus', hex: '#989B9C' },
  { name: 'Brandywine', hex: '#4C2329' },
  { name: 'Hartford Green', hex: '#293335' },
  { name: 'Cor-Ten AZP Raw', hex: '#453233' },
];

/**
 * PAC-CLAD Color Guide 2025 — 51 colors (7 Premium + 5 Timber Series Wood
 * Grain + 39 Standard), extracted from the full swatch grid on page 2 of
 * the PDF (page 1's cover teaser repeats a subset of these same Standard
 * colors and adds no new names).
 */
export const pacclad: MetalColor[] = [
  // Premium Colors
  { name: 'Anodic Clear', hex: '#8D8D87' },
  { name: 'Silversmith', hex: '#94918C' },
  { name: 'Silver', hex: '#93938F' },
  { name: 'Champagne', hex: '#837B6C' },
  { name: 'Weathered Zinc', hex: '#595957' },
  { name: 'Copper Penny', hex: '#C08A49' },
  { name: 'Weathered Steel', hex: '#5B3C38' },
  // Timber Series Wood Grain
  { name: 'Brown Timber', hex: '#634B36' },
  { name: 'Copper Timber', hex: '#955F41' },
  { name: 'Gray Timber', hex: '#6F685F' },
  { name: 'Tan Timber', hex: '#A47749' },
  { name: 'White Timber', hex: '#B4AFA9' },
  // Standard Colors
  { name: 'Bone White', hex: '#F4F3EC' },
  { name: 'Stone White', hex: '#E7E6DD' },
  { name: 'Almond', hex: '#E8E5D1' },
  { name: 'Sandstone', hex: '#E1DBC9' },
  { name: 'Sierra Tan', hex: '#C5B18F' },
  { name: 'Buckskin', hex: '#857665' },
  { name: 'Medium Bronze', hex: '#675B43' },
  { name: 'Aged Bronze', hex: '#38301D' },
  { name: 'Dark Bronze', hex: '#3F351A' },
  { name: 'Burnished Slate', hex: '#4B4940' },
  { name: 'Granite', hex: '#B2ABA2' },
  { name: 'Antique Bronze', hex: '#3E3934' },
  { name: 'Classic Bronze', hex: '#45403C' },
  { name: 'Midnight Bronze', hex: '#1E1D10' },
  { name: 'Mansard Brown', hex: '#4A2D01' },
  { name: 'Cityscape', hex: '#99A6A9' },
  { name: 'Slate Gray', hex: '#919290' },
  { name: 'Musket Gray', hex: '#727477' },
  { name: 'Charcoal', hex: '#475B65' },
  { name: 'Graphite', hex: '#57595B' },
  { name: 'Black (fka Black Aluminum)', hex: '#000000' },
  { name: 'Iron Ore', hex: '#464A4A' },
  { name: 'Inkwell', hex: '#484B49' },
  { name: 'Onyx (fka Matte Black)', hex: '#282C2E' },
  { name: 'Traditional Black', hex: '#181A1A' },
  { name: 'Terra Cotta', hex: '#B35313' },
  { name: 'Colonial Red', hex: '#913B28' },
  { name: 'Burgundy', hex: '#5B3738' },
  { name: 'Cardinal Red', hex: '#B73131' },
  { name: 'Military Blue', hex: '#3E7897' },
  { name: 'Pacific Blue (fka Slate Blue)', hex: '#366788' },
  { name: 'Interstate Blue', hex: '#004577' },
  { name: 'Berkshire Blue', hex: '#006BA9' },
  { name: 'Award Blue', hex: '#004482' },
  { name: 'Hemlock Green', hex: '#527777' },
  { name: 'Forest Green', hex: '#2E5B47' },
  { name: 'Patina Green', hex: '#398C72' },
  { name: 'Hartford Green', hex: '#1D574D' },
  { name: 'Galvalume Plus', hex: '#B6B6B6' },
];
