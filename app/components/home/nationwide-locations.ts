// hp-013 — locations plotted on NationwideMap, shared between the map
// (NationwideMapLeaflet.tsx) and its keyboard-accessible fallback list
// (NationwideMap.tsx) so the two never drift out of sync.

export interface NationwideLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Anchor on the homepage this location's marker/list entry links to, if any. */
  href?: string;
}

// AFS HQ / shop coordinates — sourced from lib/chatbot/knowledge/afs-company.ts's
// company-delivery-tracking entry ("AFS's shop coordinates ... are
// approximately 30.737075730063307, -98.23321342395246, corresponding to
// the Burnet, TX facility"), which itself matches components/track/
// DeliveryTrackingMap.tsx's AFS_SHOP_POSITION and components/hailview/
// HailViewMap.tsx's DEFAULT_CENTER exactly — one real, already-geocoded
// shop location reused a third time here rather than re-geocoded.
export const HQ_LOCATION: NationwideLocation = {
  id: 'hq',
  name: 'AFS Headquarters — 209 Sure Cast Drive, Burnet, TX 78611',
  lat: 30.737075730063307,
  lon: -98.23321342395246,
};

// Project pins: CaseStudies.tsx (hp-011) has four cards — three legacy
// photos (Copper Dome, Arched-Window Flashing, Standing-Seam Detail) with
// no location of any kind in their copy or in lib/home/portfolio-photos.ts,
// and one NASA Johnson Space Center credential card. JSC's real-world
// location (Houston, TX) is public knowledge, but no address or city/state
// is actually stated anywhere in specs/, legacy-site content, or
// STATE_OF_THE_BUILD.md — CaseStudies.tsx's own comment confirms the badge
// text was typed in "per the prompt's explicit instruction," not sourced
// from a geocoded project record. Per this prompt's instruction not to
// invent locations, no project pins are plotted; only the HQ pin below.
export const PROJECT_LOCATIONS: NationwideLocation[] = [];

export const ALL_LOCATIONS: NationwideLocation[] = [HQ_LOCATION, ...PROJECT_LOCATIONS];
