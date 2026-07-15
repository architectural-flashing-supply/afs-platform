// Shared by ProfileViewer3D's dimension labels and FlashDraft's 2D canvas
// leg-length labels — real sheet-metal fab convention is fractional
// sixteenths ("3/8""), not decimal inches.
export function formatInches(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const sixteenths = Math.round((abs - whole) * 16);
  if (sixteenths === 0) return `${sign}${whole}"`;
  if (sixteenths === 16) return `${sign}${whole + 1}"`;
  const divisor = gcd(sixteenths, 16);
  const num = sixteenths / divisor;
  const den = 16 / divisor;
  return whole > 0 ? `${sign}${whole} ${num}/${den}"` : `${sign}${num}/${den}"`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
