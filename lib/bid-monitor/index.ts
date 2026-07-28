// Single entry point for lib/bid-monitor/** — re-exports types, keyword
// matching, source fetchers, and alert-email helpers so callers outside
// this directory (routes, admin components) can import from
// '@/lib/bid-monitor' instead of reaching into individual files.

export type { BidProject, BidSource } from './types';

export { DEFAULT_DIVISION7_KEYWORDS, matchKeywords, isDivision7Relevant } from './keyword-matcher';

export type { ExtractedLink } from './html-extract';
export { extractLinks, stableExternalId } from './html-extract';

export type { BidAlertProject, SendBidAlertResult } from './alerts';
export { buildBidAlertEmailHtml, buildBidAlertSubject, sendBidAlertEmails } from './alerts';

export { fetchSamGovOpportunities } from './sources/sam-gov';
export { fetchUSASpendingOpportunities } from './sources/usaspending';
export { fetchTexasESBD } from './sources/texas-esbd';
export { fetchTexasCityPortals } from './sources/texas-cities';
export { fetchTxDOT } from './sources/txdot';
export { STATE_PORTALS, DOT_PORTALS, FREE_PLANROOMS } from './sources/state-portals';
