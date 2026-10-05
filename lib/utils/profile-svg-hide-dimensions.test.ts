import { describe, it, expect } from 'vitest';
import { generateProfileSVG, KNOWN_PROFILE_TYPES } from './profile-svg';

describe('generateProfileSVG hideDimensions', () => {
  it('omits dimension labels but keeps the outline and caption', () => {
    const withDims = generateProfileSVG({ profileType: 'coping-cap' });
    const without = generateProfileSVG({ profileType: 'coping-cap', hideDimensions: true });
    expect(withDims).toContain('afsDimArrow)');
    expect(without).not.toContain('marker-end');
    expect(without.length).toBeLessThan(withDims.length);
    expect(without).toContain('Coping Cap profile diagram');
    expect(without).not.toContain('<text');
    expect(without).toMatch(/<path d="M /);
  });

  it('default output is unchanged when the option is omitted', () => {
    for (const t of KNOWN_PROFILE_TYPES) {
      expect(generateProfileSVG({ profileType: t })).toBe(generateProfileSVG({ profileType: t, hideDimensions: false }));
    }
  });
});
