import type { BidSource } from '../types';

/**
 * Static procurement-source registry — NOT API-integrated. Most states (and
 * nearly every state DOT) publish no public bid-listing API, so unlike
 * sam-gov.ts/usaspending.ts/texas-esbd.ts/txdot.ts (which fetch and parse a
 * live response into BidProject rows), this file just enumerates the portals
 * themselves as BidSource-shaped entries. It's the reference list the admin
 * Bid Monitor dashboard renders for Steve — name, direct link, free/active
 * status — so he knows which portals to check by hand; nothing here calls
 * `fetch()`. This duplicates (in TS, not SQL) the same 50 states + DOTs +
 * free planrooms already seeded into the live `bid_sources` table by
 * supabase/migrations/010_bid_monitor.sql — that migration is the durable
 * source of truth the admin UI actually reads from; this module exists so
 * the same registry is also available as typed, importable data (e.g. for a
 * seed/reconciliation script, or a page that doesn't want a DB round-trip
 * just to list portals).
 *
 * DOT letting-page URLs beyond the 10 already seeded in 010_bid_monitor.sql
 * (TX/AL/FL/GA/CO/NC/OK/NM/AZ/LA) are best-effort — state DOT sites
 * reorganize their contractor/bidding sections periodically, so treat these
 * as a starting point for Steve to verify, not guaranteed-current links.
 */

interface StateEntry {
  abbr: string;
  name: string;
  url: string;
}

const STATE_PROCUREMENT_PORTALS: StateEntry[] = [
  { abbr: 'AL', name: 'Alabama', url: 'https://purchasing.alabama.gov' },
  { abbr: 'AK', name: 'Alaska', url: 'https://aws.state.ak.us/online/Bids.aspx' },
  { abbr: 'AZ', name: 'Arizona', url: 'https://spo.az.gov' },
  { abbr: 'AR', name: 'Arkansas', url: 'https://www.dfa.arkansas.gov/offices/procurement' },
  { abbr: 'CA', name: 'California', url: 'https://caleprocure.ca.gov' },
  { abbr: 'CO', name: 'Colorado', url: 'https://www.colorado.gov/pacific/oit/bids' },
  { abbr: 'CT', name: 'Connecticut', url: 'https://portal.ct.gov/DAS/CTSource/CTSource' },
  { abbr: 'DE', name: 'Delaware', url: 'https://mmp.delaware.gov' },
  { abbr: 'FL', name: 'Florida', url: 'https://vendor.myflorida.com' },
  { abbr: 'GA', name: 'Georgia', url: 'https://doas.ga.gov/state-purchasing' },
  { abbr: 'HI', name: 'Hawaii', url: 'https://hands.ehawaii.gov/hands/opportunities' },
  { abbr: 'ID', name: 'Idaho', url: 'https://purchasing.idaho.gov' },
  { abbr: 'IL', name: 'Illinois', url: 'https://www2.illinois.gov/cms/business/sell2/Pages/default.aspx' },
  { abbr: 'IN', name: 'Indiana', url: 'https://www.in.gov/idoa/procurement' },
  { abbr: 'IA', name: 'Iowa', url: 'https://bidopportunities.iowa.gov' },
  { abbr: 'KS', name: 'Kansas', url: 'https://supplier.sok.ks.gov' },
  { abbr: 'KY', name: 'Kentucky', url: 'https://eProcurement.ky.gov' },
  { abbr: 'LA', name: 'Louisiana', url: 'https://wwwcfprd.doa.louisiana.gov/osp/lapac/pubMain.cfm' },
  { abbr: 'ME', name: 'Maine', url: 'https://www.maine.gov/dafs/bbm/procurementservices' },
  { abbr: 'MD', name: 'Maryland', url: 'https://emaryland.buyspeed.com/bso' },
  { abbr: 'MA', name: 'Massachusetts', url: 'https://www.commbuys.com' },
  { abbr: 'MI', name: 'Michigan', url: 'https://sigma.michigan.gov/webapp/PRDVSS2X1/AltSelfService' },
  { abbr: 'MN', name: 'Minnesota', url: 'https://mn.gov/admin/supplier' },
  {
    abbr: 'MS',
    name: 'Mississippi',
    url: 'https://www.dfa.ms.gov/dfa-offices/purchasing-travel-and-fleet-management/purchasing',
  },
  { abbr: 'MO', name: 'Missouri', url: 'https://oa.mo.gov/purchasing' },
  { abbr: 'MT', name: 'Montana', url: 'https://vendor.mt.gov' },
  { abbr: 'NE', name: 'Nebraska', url: 'https://das.nebraska.gov/materiel/purchasing.html' },
  { abbr: 'NV', name: 'Nevada', url: 'https://purchasing.nv.gov' },
  { abbr: 'NH', name: 'New Hampshire', url: 'https://das.nh.gov/purchasing' },
  { abbr: 'NJ', name: 'New Jersey', url: 'https://www.njstart.gov' },
  { abbr: 'NM', name: 'New Mexico', url: 'https://www.generalservices.state.nm.us/state-purchasing' },
  { abbr: 'NY', name: 'New York', url: 'https://www.ogs.ny.gov/procurement' },
  { abbr: 'NC', name: 'North Carolina', url: 'https://vendor.ncgov.com' },
  { abbr: 'ND', name: 'North Dakota', url: 'https://www.nd.gov/omb/public/vendor-information/procurement-bids' },
  { abbr: 'OH', name: 'Ohio', url: 'https://procure.ohio.gov' },
  { abbr: 'OK', name: 'Oklahoma', url: 'https://www.ok.gov/dcs/solicit' },
  { abbr: 'OR', name: 'Oregon', url: 'https://orpin.oregon.gov' },
  { abbr: 'PA', name: 'Pennsylvania', url: 'https://www.emarketplace.state.pa.us' },
  { abbr: 'RI', name: 'Rhode Island', url: 'https://www.ridop.ri.gov' },
  { abbr: 'SC', name: 'South Carolina', url: 'https://vendor.procurement.sc.gov' },
  { abbr: 'SD', name: 'South Dakota', url: 'https://bids.sd.gov' },
  { abbr: 'TN', name: 'Tennessee', url: 'https://www.tn.gov/generalservices/procurement' },
  { abbr: 'TX', name: 'Texas', url: 'https://www.txsmartbuy.gov/esbd' },
  { abbr: 'UT', name: 'Utah', url: 'https://purchasing.utah.gov' },
  { abbr: 'VT', name: 'Vermont', url: 'https://bid.vermont.gov' },
  { abbr: 'VA', name: 'Virginia', url: 'https://eva.virginia.gov' },
  { abbr: 'WA', name: 'Washington', url: 'https://fortress.wa.gov/ga/apps/bidder/default.aspx' },
  { abbr: 'WV', name: 'West Virginia', url: 'https://www.wvpurchasing.gov' },
  { abbr: 'WI', name: 'Wisconsin', url: 'https://vendornet.wi.gov' },
  { abbr: 'WY', name: 'Wyoming', url: 'https://ai.wyo.gov/divisions/gsd/procurement' },
];

export const STATE_PORTALS: BidSource[] = STATE_PROCUREMENT_PORTALS.map((s) => ({
  id: s.abbr.toLowerCase(),
  name: `${s.name} Procurement Portal`,
  sourceType: 'state',
  state: s.abbr,
  url: s.url,
  isActive: true,
  isFree: true,
  notes: `${s.name} state procurement portal. No public bid-listing API — check manually for open solicitations.`,
}));

const STATE_DOT_LETTING_PORTALS: StateEntry[] = [
  { abbr: 'AL', name: 'Alabama', url: 'https://www.dot.state.al.us/bureaus/contracts/ContractsHome.aspx' },
  { abbr: 'AK', name: 'Alaska', url: 'https://dot.alaska.gov/creg/constbid/index.shtml' },
  { abbr: 'AZ', name: 'Arizona', url: 'https://bids.azdot.gov' },
  {
    abbr: 'AR',
    name: 'Arkansas',
    url: 'https://www.ardot.gov/divisions/programs-management/construction/bid-letting/',
  },
  { abbr: 'CA', name: 'California', url: 'https://dot.ca.gov/programs/construction/bidder-information' },
  { abbr: 'CO', name: 'Colorado', url: 'https://www.codot.gov/business/bidding' },
  { abbr: 'CT', name: 'Connecticut', url: 'https://portal.ct.gov/dot/business/contractors/bid-information' },
  { abbr: 'DE', name: 'Delaware', url: 'https://deldot.gov/Business/bids/index.shtml' },
  { abbr: 'FL', name: 'Florida', url: 'https://www.fdot.gov/procurement/bidslist.shtm' },
  { abbr: 'GA', name: 'Georgia', url: 'https://www.dot.ga.gov/PartnerSmart/Business/Pages/Letting.aspx' },
  { abbr: 'HI', name: 'Hawaii', url: 'https://hidot.hawaii.gov/highways/doing-business/bid-opportunities/' },
  { abbr: 'ID', name: 'Idaho', url: 'https://itd.idaho.gov/contracting/?target=lettings' },
  {
    abbr: 'IL',
    name: 'Illinois',
    url: 'https://idot.illinois.gov/doing-business/procurements/construction-services/index',
  },
  { abbr: 'IN', name: 'Indiana', url: 'https://www.in.gov/dot/business/' },
  { abbr: 'IA', name: 'Iowa', url: 'https://iowadot.gov/contracts/lettings' },
  { abbr: 'KS', name: 'Kansas', url: 'https://www.ksdot.org/bureaus/burConsMain/letting/default.asp' },
  {
    abbr: 'KY',
    name: 'Kentucky',
    url: 'https://transportation.ky.gov/Construction-Procurement/Pages/Letting-Information.aspx',
  },
  {
    abbr: 'LA',
    name: 'Louisiana',
    url: 'https://www.dotd.la.gov/inside_LaDOTD/Divisions/Engineering/Contracts/Pages/default.aspx',
  },
  { abbr: 'ME', name: 'Maine', url: 'https://www.maine.gov/mdot/contractors/' },
  { abbr: 'MD', name: 'Maryland', url: 'https://www.roads.maryland.gov/Index.aspx?PageId=629' },
  { abbr: 'MA', name: 'Massachusetts', url: 'https://www.mass.gov/how-to/find-highway-division-contract-advertisements' },
  { abbr: 'MI', name: 'Michigan', url: 'https://www.michigan.gov/mdot/business/bidding' },
  { abbr: 'MN', name: 'Minnesota', url: 'https://www.dot.state.mn.us/bidletting/' },
  { abbr: 'MS', name: 'Mississippi', url: 'https://mdot.ms.gov/letting/' },
  { abbr: 'MO', name: 'Missouri', url: 'https://www.modot.org/bidding-and-contracting' },
  { abbr: 'MT', name: 'Montana', url: 'https://www.mdt.mt.gov/business/contracting/' },
  { abbr: 'NE', name: 'Nebraska', url: 'https://dot.nebraska.gov/business-center/contract-letting/' },
  {
    abbr: 'NV',
    name: 'Nevada',
    url: 'https://www.dot.nv.gov/doing-business/highway-construction-program/contractor-information/bid-information',
  },
  { abbr: 'NH', name: 'New Hampshire', url: 'https://www.dot.nh.gov/business-nhdot/bid-proposal-information' },
  { abbr: 'NJ', name: 'New Jersey', url: 'https://www.state.nj.us/transportation/business/procurement/' },
  {
    abbr: 'NM',
    name: 'New Mexico',
    url: 'https://dot.nm.gov/content/dot/en/public/business-with-nmdot/bid-letting.html',
  },
  { abbr: 'NY', name: 'New York', url: 'https://www.dot.ny.gov/doing-business/opportunities/const-notices' },
  { abbr: 'NC', name: 'North Carolina', url: 'https://connect.ncdot.gov/letting/Pages/default.aspx' },
  { abbr: 'ND', name: 'North Dakota', url: 'https://www.dot.nd.gov/business/letting.htm' },
  {
    abbr: 'OH',
    name: 'Ohio',
    url: 'https://www.transportation.ohio.gov/working/contracting/bidding-and-letting-information',
  },
  { abbr: 'OK', name: 'Oklahoma', url: 'https://www.odot.org/business/bid-lettings' },
  { abbr: 'OR', name: 'Oregon', url: 'https://www.oregon.gov/odot/Business/Pages/Bid-Letting.aspx' },
  { abbr: 'PA', name: 'Pennsylvania', url: 'https://www.penndot.pa.gov/Doing-Business/Bidding/Pages/default.aspx' },
  { abbr: 'RI', name: 'Rhode Island', url: 'https://www.dot.ri.gov/business/index.php' },
  { abbr: 'SC', name: 'South Carolina', url: 'https://www.scdot.org/business/bid-letting-info.aspx' },
  { abbr: 'SD', name: 'South Dakota', url: 'https://dot.sd.gov/business/contractors/letting-information' },
  { abbr: 'TN', name: 'Tennessee', url: 'https://www.tn.gov/tdot/letting-and-contract-administration.html' },
  { abbr: 'TX', name: 'Texas', url: 'https://www.txdot.gov/business/contractors/highway-letting.html' },
  { abbr: 'UT', name: 'Utah', url: 'https://www.udot.utah.gov/business/index.php?a=ctrctBidding' },
  { abbr: 'VT', name: 'Vermont', url: 'https://vtrans.vermont.gov/contract-admin/bids' },
  { abbr: 'VA', name: 'Virginia', url: 'https://www.virginiadot.org/business/const/bids.asp' },
  {
    abbr: 'WA',
    name: 'Washington',
    url: 'https://wsdot.wa.gov/engineering-standards/all-technical-disciplines/plans-specifications-estimates/bid-tabs',
  },
  { abbr: 'WV', name: 'West Virginia', url: 'https://transportation.wv.gov/highways/contractadmin/Pages/Lettings.aspx' },
  {
    abbr: 'WI',
    name: 'Wisconsin',
    url: 'https://wisconsindot.gov/Pages/doing-bus/contractors/hwy-dev-pgm/default.aspx',
  },
  { abbr: 'WY', name: 'Wyoming', url: 'https://www.dot.state.wy.us/home/business_with_wydot/contracts_and_bids.html' },
];

export const DOT_PORTALS: BidSource[] = STATE_DOT_LETTING_PORTALS.map((s) => ({
  id: `${s.abbr.toLowerCase()}-dot`,
  name: `${s.name} DOT Letting Portal`,
  sourceType: 'dot',
  state: s.abbr,
  url: s.url,
  isActive: true,
  isFree: true,
  notes: `${s.name} Department of Transportation construction letting/bid calendar. No public API — check manually for Division 7-relevant lettings (rest areas, maintenance buildings, district offices).`,
}));

export const FREE_PLANROOMS: BidSource[] = [
  {
    id: 'planhub',
    name: 'PlanHub',
    sourceType: 'planroom',
    url: 'https://www.planhub.com',
    isActive: true,
    isFree: true,
    notes:
      'Free for subcontractors — register at planhub.com. Placeholder for a future PLANHUB_API_KEY integration; no live API call is wired yet.',
  },
  {
    id: 'bidplanroom',
    name: 'BidPlanroom',
    sourceType: 'planroom',
    url: 'https://www.bidplanroom.com',
    isActive: true,
    isFree: true,
    notes: 'Free public project listings. No API — web monitoring required.',
  },
  {
    id: 'constructconnect',
    name: 'ConstructConnect Free Tier',
    sourceType: 'planroom',
    url: 'https://www.constructconnect.com',
    isActive: true,
    isFree: true,
    notes: 'Free bid-invitation tier for subcontractors. No public API — web monitoring required.',
  },
  {
    id: 'sub-hub',
    name: 'Sub-Hub',
    sourceType: 'planroom',
    url: 'https://constructionbids.ai/sub-hub',
    isActive: true,
    isFree: true,
    notes: 'Free construction-bid aggregator. No public API — web monitoring required.',
  },
];
