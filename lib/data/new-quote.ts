import type { SupabaseClient } from '@supabase/supabase-js';
import { getCustomersList, type CustomerListRow } from '@/lib/data/customers';

/**
 * THE NEW QUOTE SCREEN'S DATA — v7 `pageNewQuote()` (prototype line 1761).
 *
 * v7's premise, and the reason this screen exists at all: "Most quotes are for
 * repeat customers. Pick one and their saved profiles come right up." So the
 * screen is CUSTOMER FIRST, and everything here serves that — who has ordered
 * recently, what they last ordered, and what profiles they already have saved.
 *
 * NOTHING NEW IS QUERIED THAT THE APP DID NOT ALREADY HAVE. Recent customers
 * come from `getCustomersList`, which already aggregates each account's order
 * count and last-order date; the saved profiles are the same
 * `saved_configurations` rows the Job screen's "past profiles" block reads; the
 * last order is the newest `orders` row. There is no new table and no migration
 * — this run makes no schema change at all.
 *
 * WHAT IS DELIBERATELY NOT HERE. v7's left rail shows a per-customer count of
 * "Past quotes and orders"; this uses `totalOrders`, which counts ORDERS only,
 * because that is what the existing aggregate computes and inventing a second
 * count would mean a second query per customer on every keystroke.
 */

/** One row in v7's "Recent customers" list (`custRecent()`, line 1744). */
export interface RecentCustomer {
  id: string;
  /** Company if we know it, else the person's name — what v7 prints in bold. */
  name: string;
  /** v7's `.pn` line: the contact person. */
  person: string;
  email: string;
  /** v7's `.oj` badge. */
  orderCount: number;
  lastOrderAt: string | null;
}

/**
 * v7 sorts its customer list by WHEN THEY LAST ORDERED, newest first, so the
 * people most likely to be calling today are at the top. A customer who has
 * never ordered sorts to the bottom rather than being hidden — they are still
 * someone you might be quoting for.
 */
export function sortByMostRecentOrder(rows: RecentCustomer[]): RecentCustomer[] {
  return [...rows].sort((a, b) => {
    if (a.lastOrderAt === b.lastOrderAt) return a.name.localeCompare(b.name);
    if (a.lastOrderAt === null) return 1;
    if (b.lastOrderAt === null) return -1;
    return a.lastOrderAt < b.lastOrderAt ? 1 : -1;
  });
}

/** v7 filters the list as you type, against the company AND the person. */
export function matchCustomers(rows: RecentCustomer[], query: string): RecentCustomer[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => `${r.name} ${r.person} ${r.email}`.toLowerCase().includes(q));
}

function toRecent(row: CustomerListRow): RecentCustomer {
  return {
    id: row.id,
    // v7 leads with the company, because that is how the shop refers to a job.
    // A personal account with no company falls back to the person's name rather
    // than rendering an empty row.
    name: row.company?.trim() || row.fullName,
    person: row.fullName,
    email: row.email,
    orderCount: row.totalOrders,
    lastOrderAt: row.lastOrderAt,
  };
}

export async function getRecentCustomers(supabase: SupabaseClient): Promise<RecentCustomer[]> {
  // `role: 'all'` — v7's list is every customer, not a filtered directory.
  const rows = await getCustomersList(supabase, { search: '', role: 'all', tier: 'all' });
  return sortByMostRecentOrder(rows.map(toRecent));
}

/** A saved profile card on the right-hand side (v7 `.pcard`, line 1773). */
export interface SavedProfileCard {
  id: string;
  name: string;
  savedAt: string;
}

/** What v7's green "Fastest way: reorder their last order" strip needs. */
export interface LastOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  totalCents: number | null;
}

export interface NewQuoteCustomer {
  customer: RecentCustomer;
  savedProfiles: SavedProfileCard[];
  lastOrder: LastOrder | null;
}

/** How many profile cards v7 shows before the list would run off the screen. */
export const SAVED_PROFILE_LIMIT = 12;

export async function getNewQuoteCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<NewQuoteCustomer | null> {
  const all = await getRecentCustomers(supabase);
  const customer = all.find((c) => c.id === customerId);
  if (!customer) return null;

  // The same `saved_configurations` rows the Job screen's past-profiles block
  // reads. NAMES AND DATES ONLY — the drawings are fetched one at a time by
  // LazyProfileThumb as they scroll into view, because that column holds a
  // base64 PNG measured at 70KB-786KB a row (CLAUDE.md rule #26).
  const { data: saved } = await supabase
    .from('saved_configurations')
    .select('id, name, created_at')
    .eq('user_id', customerId)
    .order('created_at', { ascending: false })
    .limit(SAVED_PROFILE_LIMIT);

  const savedProfiles: SavedProfileCard[] = (
    (saved ?? []) as { id: string; name: string | null; created_at: string }[]
  ).map((s) => ({
    id: s.id,
    name: s.name?.trim() || 'Saved profile',
    savedAt: s.created_at,
  }));

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total, created_at')
    .eq('user_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1);

  const row = ((orders ?? []) as { id: string; order_number: string; total: number | null; created_at: string }[])[0];
  const lastOrder: LastOrder | null = row
    ? {
        id: row.id,
        orderNumber: row.order_number,
        placedAt: row.created_at,
        // `orders.total` is DOLLARS in this table, unlike the cents used in
        // pricing. Converted here, once, rather than at each render site.
        totalCents: row.total === null ? null : Math.round(Number(row.total) * 100),
      }
    : null;

  return { customer, savedProfiles, lastOrder };
}
