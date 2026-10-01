/**
 * The Products page's data layer, asserted against the REAL manifest.
 *
 * Three things this has to protect, because all three are silent when wrong:
 *   - a flagged or non-product entry leaking onto a public page,
 *   - roofing drifting up above the flashing categories,
 *   - a name derivation that quietly reworded a product.
 */
import { describe, it, expect } from 'vitest';
import {
  PRODUCT_MANIFEST,
  CATEGORY_DISPLAY_ORDER,
  deriveDisplayName,
  getCatalogProducts,
  getCatalogSections,
  isPublishable,
  mapDisplayCategory,
  type ProductRenderEntry,
} from '@/lib/data/products-page';

describe('what reaches the public page', () => {
  it('excludes every needsReview entry', () => {
    const flagged = PRODUCT_MANIFEST.filter((e) => e.needsReview).map((e) => e.id);
    expect(flagged.length).toBeGreaterThan(0); // the premise, not just the fix

    const shownIds = new Set(getCatalogProducts().map((p) => p.id));
    for (const id of flagged) expect(shownIds.has(id)).toBe(false);
  });

  it('excludes montages, swatches and the non-product machine photo', () => {
    const notProducts = PRODUCT_MANIFEST.filter((e) => e.type !== 'product');
    expect(notProducts.length).toBeGreaterThan(0);

    const shownIds = new Set(getCatalogProducts().map((p) => p.id));
    for (const e of notProducts) expect(shownIds.has(e.id)).toBe(false);

    // Named explicitly: this one is a photograph of a bending machine and must
    // never be published as a SKU.
    expect(shownIds.has('rbm-25-38-machine-photo')).toBe(false);
  });

  it('shows only entries that are product AND not flagged', () => {
    const expected = PRODUCT_MANIFEST.filter((e) => e.type === 'product' && !e.needsReview);
    expect(getCatalogProducts()).toHaveLength(expected.length);
    expect(expected.length).toBeGreaterThan(0);
  });

  it('isPublishable rejects each disqualifier on its own', () => {
    const base: ProductRenderEntry = {
      id: 'x', type: 'product', sourceName: 'X', nameSource: 'filename', description: '',
      category: 'Trim & Closures', subcategory: 'Closure', imageFiles: ['/images/products/x.webp'],
      geometryMatch: null, needsReview: false,
    };
    expect(isPublishable(base)).toBe(true);
    expect(isPublishable({ ...base, needsReview: true })).toBe(false);
    expect(isPublishable({ ...base, type: 'montage' })).toBe(false);
    expect(isPublishable({ ...base, type: 'non-product' })).toBe(false);
  });

  it('never exposes a review note or a flagged entry through the product shape', () => {
    for (const p of getCatalogProducts()) {
      expect(Object.keys(p)).not.toContain('reviewNote');
      expect(Object.keys(p)).not.toContain('needsReview');
    }
  });
});

describe('category order', () => {
  it('puts a flashing category first and Roofing Panels last', () => {
    const sections = getCatalogSections();
    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].category).not.toBe('Roofing Panels');
    expect(sections[0].category).not.toBe('Roofing');
    expect(sections[sections.length - 1].category).toBe('Roofing Panels');
  });

  it('orders every section by CATEGORY_DISPLAY_ORDER', () => {
    const indexes = getCatalogSections().map((s) => CATEGORY_DISPLAY_ORDER.indexOf(s.category));
    expect(indexes).not.toContain(-1);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
  });

  it('lists Roofing and Roofing Panels after every other known category', () => {
    const roofingFirst = Math.min(
      CATEGORY_DISPLAY_ORDER.indexOf('Roofing'),
      CATEGORY_DISPLAY_ORDER.indexOf('Roofing Panels')
    );
    expect(roofingFirst).toBe(CATEGORY_DISPLAY_ORDER.length - 2);
  });

  it('folds Standing Seam into Roofing Panels without renaming anything else', () => {
    expect(mapDisplayCategory('Standing Seam')).toBe('Roofing Panels');
    expect(mapDisplayCategory('Roofing')).toBe('Roofing Panels');
    expect(mapDisplayCategory('Coping Caps & Cleats')).toBe('Coping Caps & Cleats');
    expect(mapDisplayCategory('Trim & Closures')).toBe('Trim & Closures');
  });

  it('keeps Trim & Closures as its own category', () => {
    const sections = getCatalogSections();
    const trim = sections.find((s) => s.category === 'Trim & Closures');
    expect(trim).toBeDefined();
    expect(trim!.products.length).toBeGreaterThan(0);
  });

  it('folds a Standing Seam entry into the Roofing Panels section', () => {
    const synthetic: ProductRenderEntry[] = [
      { id: 'ss-1', type: 'product', sourceName: 'Seam Panel', nameSource: 'filename', description: '',
        category: 'Standing Seam', subcategory: 'Panel', imageFiles: ['/images/products/a.webp'],
        geometryMatch: null, needsReview: false },
      { id: 'cope-1', type: 'product', sourceName: 'Coping', nameSource: 'filename', description: '',
        category: 'Coping Caps & Cleats', subcategory: 'Edge Metal', imageFiles: ['/images/products/b.webp'],
        geometryMatch: 'coping-cap', needsReview: false },
    ];
    const sections = getCatalogSections(synthetic);
    expect(sections.map((s) => s.category)).toEqual(['Coping Caps & Cleats', 'Roofing Panels']);
  });
});

describe('deriveDisplayName', () => {
  // The five sample filenames required by the brief.
  it('derives names from filenames mechanically', () => {
    expect(deriveDisplayName('eave-trim-sample-02.webp')).toBe('Eave Trim');
    expect(deriveDisplayName('trims-zee-final-01')).toBe('Trims Zee');
    expect(deriveDisplayName('perforated-z-closure')).toBe('Perforated Z Closure');
    expect(deriveDisplayName('t-style-drip-edge')).toBe('T Style Drip Edge');
    expect(deriveDisplayName('snap_lock_flat')).toBe('Snap Lock Flat');
  });

  it('keeps words that already carry a capital exactly as written', () => {
    expect(deriveDisplayName('Econo Coping LT')).toBe('Econo Coping LT');
    expect(deriveDisplayName('DMC 200S Seamed 180')).toBe('DMC 200S Seamed');
    expect(deriveDisplayName('Fascia Extender w/ Offset')).toBe('Fascia Extender w/ Offset');
    expect(deriveDisplayName('SL Ribs Striations (Snap-Lock)')).toBe('SL Ribs Striations (Snap-Lock)');
  });

  it('strips trailing bookkeeping but not a word in the middle', () => {
    expect(deriveDisplayName('Vented Ridge Sample 02')).toBe('Vented Ridge');
    expect(deriveDisplayName('Sample Holder Bracket')).toBe('Sample Holder Bracket');
    expect(deriveDisplayName('Fascia LT 3')).toBe('Fascia LT');
  });

  it('does not reword, translate or expand anything', () => {
    expect(deriveDisplayName('J-Channel')).toBe('J-Channel');
    expect(deriveDisplayName('Reglet')).toBe('Reglet');
  });

  it('gives every live product a non-empty name', () => {
    for (const p of getCatalogProducts()) {
      expect(p.name.trim().length).toBeGreaterThan(0);
      expect(p.name).not.toMatch(/\.webp$/i);
    }
  });
});

describe('product shape', () => {
  it('points every image at a public /images/products path', () => {
    for (const p of getCatalogProducts()) {
      expect(p.image.startsWith('/images/products/')).toBe(true);
      expect(p.image.endsWith('.webp')).toBe(true);
    }
  });

  it('only carries geometry values that are real ProfileType members', () => {
    const withGeometry = getCatalogProducts().filter((p) => p.geometryMatch);
    expect(withGeometry.length).toBeGreaterThan(0);
    // Mirrors the manifest's own entries — no new geometry is minted here.
    for (const p of withGeometry) {
      const source = PRODUCT_MANIFEST.find((e) => e.id === p.id);
      expect(p.geometryMatch).toBe(source!.geometryMatch);
    }
  });
});
