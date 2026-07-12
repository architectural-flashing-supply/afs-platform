// Approximate sheet thickness for the 3D Profile Viewer's extrusion depth —
// visual reference only, not a fabrication spec. Standard sheet-steel gauge
// table (in mm); non-gauge formats (decimal inch, direct mm, copper oz) are
// parsed directly since GAUGES_BY_MATERIAL mixes all four conventions.
const STEEL_GAUGE_MM: Record<string, number> = {
  '26': 0.48,
  '24': 0.61,
  '22': 0.76,
  '20': 0.91,
  '18': 1.21,
  '16': 1.52,
};

export function gaugeToThicknessMm(gauge: string | null | undefined): number {
  if (!gauge) return 0.6;
  const trimmed = gauge.trim();

  const gaMatch = trimmed.match(/^(\d+)\s*ga$/i);
  if (gaMatch && STEEL_GAUGE_MM[gaMatch[1]]) return STEEL_GAUGE_MM[gaMatch[1]];

  const mmMatch = trimmed.match(/^([\d.]+)\s*mm$/i);
  if (mmMatch) return parseFloat(mmMatch[1]);

  const inMatch = trimmed.match(/^0?\.(\d+)"?$/);
  if (inMatch) return parseFloat(`0.${inMatch[1]}`) * 25.4;

  const ozMatch = trimmed.match(/^(\d+)\s*oz$/i);
  if (ozMatch) {
    // Copper roofing weight: 16 oz/sq ft ≈ 0.55mm, 20 oz/sq ft ≈ 0.69mm.
    const oz = parseInt(ozMatch[1], 10);
    return (oz / 16) * 0.55;
  }

  return 0.6;
}
