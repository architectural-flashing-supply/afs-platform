import { describe, it, expect } from 'vitest';
import {
  ALL_MATERIALS,
  GAUGES_BY_MATERIAL,
  MATERIAL_SHORTHAND,
  MATERIAL_STOCK_STATUS,
  gaugesForMaterial,
  normalizeMaterialLabel,
} from './catalog';
import { MATERIAL_LABEL_TO_CATEGORY, colorPaletteForMaterial } from './material-color-requirement';

// 2026-09-29 rename: "Galvanized Galvalume" -> "Galvalume". Galvalume is
// itself an aluminum-zinc coating on steel, so the old label named the
// coating twice. These tests pin both halves of the change: the new label is
// the only one the UI offers, and rows written under the old label still
// resolve.
const LEGACY = 'Galvanized Galvalume';

describe('Galvalume material rename', () => {
  it('offers exactly one Galvalume option, labelled "Galvalume"', () => {
    const materials = ALL_MATERIALS as readonly string[];
    expect(materials).toContain('Galvalume');
    expect(materials).not.toContain(LEGACY);
    expect(materials.filter((m) => /galvalume/i.test(m))).toEqual(['Galvalume']);
  });

  it('leaves the standalone Galvanized Steel option untouched', () => {
    // A different material (G90 zinc coating), not an alias of Galvalume.
    expect(ALL_MATERIALS as readonly string[]).toContain('Galvanized Steel');
    expect(normalizeMaterialLabel('Galvanized Steel')).toBe('Galvanized Steel');
    expect(MATERIAL_LABEL_TO_CATEGORY['Galvanized Steel']).toBe('galvanized');
  });

  it('carries the old entry\'s gauges, stock status, shorthand and category unchanged', () => {
    expect(GAUGES_BY_MATERIAL['Galvalume']).toEqual(['26 ga', '24 ga', '22 ga', '20 ga', '18 ga']);
    // identical to the other steel-gauge materials, as the old entry was
    expect(GAUGES_BY_MATERIAL['Galvalume']).toEqual(GAUGES_BY_MATERIAL['Galvanized Steel']);
    expect(MATERIAL_STOCK_STATUS['Galvalume']).toBe('fabricated');
    expect(MATERIAL_SHORTHAND['Galvalume']).toBe('Galvalume');
    expect(MATERIAL_LABEL_TO_CATEGORY['Galvalume']).toBe('galvalume');
  });

  it('has no lingering "Galvanized Galvalume" key in any material map', () => {
    expect(GAUGES_BY_MATERIAL[LEGACY]).toBeUndefined();
    expect(MATERIAL_STOCK_STATUS[LEGACY]).toBeUndefined();
    expect(MATERIAL_SHORTHAND[LEGACY]).toBeUndefined();
    expect(MATERIAL_LABEL_TO_CATEGORY[LEGACY]).toBeUndefined();
  });

  describe('legacy read-time alias', () => {
    it('resolves every legacy spelling to "Galvalume"', () => {
      for (const legacy of [
        LEGACY,
        'galvanized galvalume',
        'GALVANIZED GALVALUME',
        'galvanized-galvalume',
        'galvanized_galvalume',
        '  Galvanized Galvalume  ',
      ]) {
        expect(normalizeMaterialLabel(legacy)).toBe('Galvalume');
      }
    });

    it('gives a legacy-labelled row the same gauges as the new label', () => {
      expect(gaugesForMaterial(LEGACY)).toEqual(gaugesForMaterial('Galvalume'));
      expect(gaugesForMaterial(LEGACY)).not.toHaveLength(0);
    });

    it('gives a legacy-labelled row the same colour palette behaviour', () => {
      expect(colorPaletteForMaterial(LEGACY)).toEqual(colorPaletteForMaterial('Galvalume'));
    });

    it('accepts the canonical label and slug forms of every material', () => {
      for (const m of ALL_MATERIALS) {
        expect(normalizeMaterialLabel(m)).toBe(m);
        expect(normalizeMaterialLabel(m.toLowerCase().replace(/\s+/g, '-'))).toBe(m);
      }
    });

    it('passes through unknown and empty values rather than dropping them', () => {
      expect(normalizeMaterialLabel('Unobtainium')).toBe('Unobtainium');
      expect(normalizeMaterialLabel('')).toBe('');
      expect(normalizeMaterialLabel(null)).toBe('');
      expect(normalizeMaterialLabel(undefined)).toBe('');
    });
  });
});
