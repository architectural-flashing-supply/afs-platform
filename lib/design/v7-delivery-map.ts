/**
 * v7's DELIVERY ROUTE MAP, TRANSLITERATED — and what it is actually for.
 *
 * This is `mapSVG()` from the prototype (line 1786): a hand-drawn schematic of
 * the Burnet-to-Austin corridor with six town labels, four painted roads, a
 * dashed route polyline, a numbered marker per stop, the shop and a truck.
 * Every coordinate is v7's own.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT IS A FIXTURE-ONLY DRAWING, AND THE LIVE SCREEN MUST NOT USE IT.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v7 says so itself, in its own caption under the panel: "Sample positions. In
 * the real build this panel is the same Track Deliveries map customers already
 * see on the website." Its `DPOS` table is eleven hardcoded x/y pairs for its
 * eleven sample companies, and `dpos()` falls back to a HASH OF THE COMPANY
 * NAME for anyone else — which would place a real customer at a position that
 * has nothing to do with where they are.
 *
 * So the live Deliveries screen keeps `components/admin/DeliveryTrackPanel.tsx`,
 * which renders the real `DeliveryTrackingMap` the customer already sees. This
 * module exists so the pixel gate can measure the LAYOUT AROUND the map against
 * the prototype — the split, the day tabs, the stop rows, the schedule column —
 * without the map itself being an uncomparable hole in the middle of it.
 * CLAUDE.md rule #33's own carve-out: existing code wins where it supplies real
 * behaviour v7 only fakes.
 *
 * Do not point this at a real delivery. Drawing a customer at a hashed
 * coordinate is worse than drawing no map at all.
 */

/** v7 `DPOS` — its eleven sample companies' positions in the 640x420 viewBox. */
export const V7_MAP_POS: Record<string, [number, number]> = {
  'Hill Country Roofing': [150, 255],
  'Martinez Builders': [300, 305],
  'Round Rock Roofing': [450, 232],
  'Georgetown Siding Co.': [385, 125],
  'Cedar Park Contractors': [335, 205],
  'Pflugerville Metal Works': [490, 268],
  'Lakeway Custom Homes': [290, 350],
  'Bluebonnet Exteriors': [235, 170],
  'Ortega Roofing': [205, 215],
  'Liberty Hill Homes': [285, 110],
  'Hutto Metal Roofing': [545, 205],
};

/** v7 `SHOPXY` — the AFS shop in Burnet. */
export const V7_SHOP_XY: [number, number] = [115, 62];

/** v7 `dpos()` — the table, else a hash. See this file's header on the hash. */
function dpos(c: string): [number, number] {
  if (V7_MAP_POS[c]) return V7_MAP_POS[c];
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) % 9973;
  return [90 + (h % 470), 90 + ((h * 7) % 270)];
}

function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface V7MapStop {
  /** Used only as the marker's label; never looked up anywhere. */
  customer: string;
  selected: boolean;
}

/**
 * v7 `mapSVG(day)`. `dayLabel` only reaches the accessible name.
 *
 * `truckProgress` is v7's own `f`: 0.55 along the first leg on today's tab, 0
 * on any other day, because on a future day the truck has not left the shop.
 * Passed in rather than recomputed so the caller decides what "today" is.
 */
export function v7MapSVG(stops: V7MapStop[], dayLabel: string, truckProgress: number): string {
  const pts: [number, number][] = [V7_SHOP_XY, ...stops.map((s) => dpos(s.customer))];
  const route = pts.map((p) => `${p[0]},${p[1]}`).join(' ');

  const road =
    '<path d="M115 62 C190 100 240 105 285 110 S345 150 385 125 S440 205 450 232 S520 215 545 205" fill="none" stroke="#CBD2DB" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M285 110 C300 150 320 175 335 205 S300 280 300 305 S295 330 290 350" fill="none" stroke="#D6DBE3" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M335 205 C380 215 420 225 450 232 S480 255 490 268" fill="none" stroke="#D6DBE3" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M115 62 C130 130 140 200 150 255 S160 285 205 215" fill="none" stroke="#DDE2E9" stroke-width="5" stroke-linecap="round"/>';

  const towns: [string, number, number][] = [
    ['Burnet', 60, 40],
    ['Liberty Hill', 238, 86],
    ['Georgetown', 395, 96],
    ['Round Rock', 405, 262],
    ['Austin', 300, 392],
    ['Hutto', 548, 176],
  ];
  const townMarkup = towns
    .map((t) => `<text x="${t[1]}" y="${t[2]}" font-size="12" fill="#7B8594" font-weight="600">${t[0]}</text>`)
    .join('');

  const line = stops.length
    ? `<polyline points="${route}" fill="none" stroke="#141A24" stroke-width="3.5" stroke-dasharray="9 7" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

  const marks = stops
    .map((s, i) => {
      const p = dpos(s.customer);
      const on = s.selected;
      return (
        `<g class="mk" style="cursor:pointer">` +
        `<circle cx="${p[0]}" cy="${p[1]}" r="${on ? 17 : 14}" fill="${on ? '#C8102E' : '#141A24'}" stroke="#fff" stroke-width="3"/>` +
        `<text x="${p[0]}" y="${p[1] + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${i + 1}</text>` +
        `<text x="${p[0]}" y="${p[1] + 34}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0F1318" stroke="#EEF1F4" stroke-width="4" paint-order="stroke">${esc(s.customer)}</text>` +
        `</g>`
      );
    })
    .join('');

  const shop =
    `<g><rect x="${V7_SHOP_XY[0] - 13}" y="${V7_SHOP_XY[1] - 13}" width="26" height="26" rx="5" fill="#C8102E" stroke="#fff" stroke-width="3"/>` +
    `<text x="${V7_SHOP_XY[0]}" y="${V7_SHOP_XY[1] + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">AFS</text>` +
    `<text x="${V7_SHOP_XY[0] + 20}" y="${V7_SHOP_XY[1] - 18}" font-size="11.5" font-weight="600" fill="#0F1318" stroke="#EEF1F4" stroke-width="4" paint-order="stroke">AFS shop, Burnet</text></g>`;

  let truck = '';
  if (stops.length) {
    const a = pts[0];
    const b = pts[1];
    const x = a[0] + (b[0] - a[0]) * truckProgress;
    const y = a[1] + (b[1] - a[1]) * truckProgress;
    truck =
      `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})">` +
      `<circle r="19" fill="#fff" stroke="#141A24" stroke-width="2.5"/>` +
      `<rect x="-11" y="-6" width="14" height="10" rx="2" fill="#141A24"/>` +
      `<path d="M3 -3 H8 L12 1 V4 H3Z" fill="#141A24"/>` +
      `<circle cx="-5" cy="6" r="2.4" fill="#C8102E"/><circle cx="7" cy="6" r="2.4" fill="#C8102E"/></g>`;
  }

  return (
    `<svg viewBox="0 0 640 420" role="img" aria-label="Map of the delivery route for ${esc(dayLabel)}">` +
    '<rect width="640" height="420" fill="#EEF1F4"/>' +
    '<path d="M0 330 C120 300 210 360 330 330 S560 350 640 320 L640 420 L0 420Z" fill="#DCE6EE"/>' +
    road +
    townMarkup +
    line +
    marks +
    shop +
    truck +
    '</svg>'
  );
}
