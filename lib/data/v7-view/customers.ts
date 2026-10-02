/**
 * CUSTOMERS — v7's master-detail, for both sides.
 *
 * v7 `pageCustomers()` (line 1519) is a `.cgrid`: every company down the left,
 * and on the right that company's contact line, its jobs and its saved
 * profiles. The live screen was built as an ACCOUNT DIRECTORY instead — a
 * filtered table of every registered account with role, pricing tier and CSV
 * export — because those are real things this app has and v7 has none of them.
 *
 * THAT DIVERGENCE IS NOW RESOLVED THE WAY RULE #33 SAYS: v7 wins the layout,
 * the live app keeps the behaviour. So both sides render v7's master-detail,
 * and the directory's three real features live inside it:
 *
 *   - the role and tier filters move into v7's own `.bar`, which the Search and
 *     list screens already use, so they are v7 elements rather than new ones;
 *   - CSV export stays, as a button in the `.greet` row where v7 puts a page
 *     action;
 *   - the per-account record at /admin/customers/[id] is still one click away,
 *     from the detail pane's heading.
 *
 * WHAT THE LIVE DETAIL PANE CANNOT FILL. v7 lists a customer's jobs and their
 * saved profile thumbnails. Both need a per-customer read this page does not
 * do, and adding profile thumbnails here would be a third mount point for the
 * one profile panel CLAUDE.md rule #27 allows. So the live pane says where
 * those live and links to them, rather than showing an empty table that looks
 * like "this customer has no work".
 */
import { V7_CUSTS, emailOf, itemLabel, jid, personOf, v7Fixture } from '@/lib/fixtures/command-center-v7';
import { V7_NAMES } from '@/lib/design/v7-draw';
import type { CustomerListRow } from '@/lib/data/customers';
import type { V7DrawingRef } from './types';

export interface V7CustomerListItem {
  key: string;
  company: string;
  person: string;
  /** v7's `.oj` badge — open jobs for this customer. */
  openJobs: number;
  selected: boolean;
  href: string;
}

export interface V7CustomerJobRow {
  key: string;
  jobId: string;
  item: string;
  /** v7's `.st.<lane>` chip. */
  stageKey: string;
  stageLabel: string;
  href: string;
}

export interface V7CustomerDetail {
  name: string;
  person: string;
  email: string;
  /** Where the full account record lives, when there is one. */
  recordHref: string | null;
  /**
   * v7's inline contact editor (`S.cust.edit`): two fields and Save/Cancel in
   * place of the contact line. Fixture only — the live app edits a contact on
   * the account's own record at /admin/customers/[id], which is where the
   * audit trail and the rest of the account live, and a second editor here
   * would be a second writer to the same row.
   */
  editing: boolean;
  editHref: string;
  doneEditHref: string;
  jobs: V7CustomerJobRow[];
  /** Null when this side cannot read them — never an empty list that lies. */
  profiles: { key: string; drawing: V7DrawingRef; label: string; href: string }[] | null;
  profilesNote: string;
  jobsEmpty: string;
}

export interface V7CustomersView {
  list: V7CustomerListItem[];
  detail: V7CustomerDetail | null;
  /** Live only: the directory's real filters, in v7's own `.bar`. */
  filters: { name: string; label: string; value: string; placeholder?: string; options?: [string, string][] }[];
  showExport: boolean;
}

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Done',
};

/** v7 `pageCustomers()` over v7's own eleven companies. */
export function fixtureCustomers(selected?: string, editing = false): V7CustomersView {
  const f = v7Fixture();
  const names = V7_CUSTS.map((c) => c[0]).sort();
  const sel = selected && names.includes(selected) ? selected : 'Hill Country Roofing';

  const list: V7CustomerListItem[] = names.map((n) => ({
    key: n,
    company: n,
    person: personOf(n),
    openJobs: f.jobs.filter((j) => j.cust === n && j.lane !== 'done').length,
    selected: n === sel,
    href: `/admin/customers?c=${encodeURIComponent(n)}&fixture=v7`,
  }));

  const jobs: V7CustomerJobRow[] = f.jobs
    .filter((j) => j.cust === sel)
    .map((j) => ({
      key: String(j.n),
      jobId: jid(j.n),
      item: itemLabel(j),
      stageKey: j.lane,
      stageLabel: STAGE_LABEL[j.lane],
      href: `/admin/command-center/job/${j.n}`,
    }));

  const profiles = f.profiles
    .filter((p) => p.cust === sel)
    .map((p) => ({
      key: String(p.id),
      drawing: { kind: p.kind, d: p.d, hi: [], paint: p.paint } as V7DrawingRef,
      label: V7_NAMES[p.kind],
      href: `/admin/search?pid=${p.id}&fixture=v7`,
    }));

  return {
    list,
    detail: {
      name: sel,
      person: personOf(sel),
      email: emailOf(sel),
      recordHref: null,
      editing,
      editHref: `/admin/customers?c=${encodeURIComponent(sel)}&edit=1&fixture=v7`,
      doneEditHref: `/admin/customers?c=${encodeURIComponent(sel)}&fixture=v7`,
      jobs,
      profiles,
      profilesNote: 'No saved profiles yet.',
      jobsEmpty: 'No jobs yet.',
    },
    filters: [],
    showExport: false,
  };
}

/** The same screen over the live account directory. */
export function liveCustomers(
  rows: CustomerListRow[],
  filters: { search: string; role: string; tier: string },
  selectedId?: string,
): V7CustomersView {
  const sel = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const list: V7CustomerListItem[] = rows.map((r) => ({
    key: r.id,
    company: r.company?.trim() || r.fullName,
    person: r.company?.trim() ? r.fullName : r.email,
    // v7's badge counts OPEN jobs. The directory read counts TOTAL orders, which
    // is a different number — so the badge shows what this read really knows and
    // its title says which, rather than passing one off as the other.
    openJobs: r.totalOrders,
    selected: sel ? r.id === sel.id : false,
    href: `/admin/customers?c=${encodeURIComponent(r.id)}`,
  }));

  return {
    list,
    detail: sel
      ? {
          name: sel.company?.trim() || sel.fullName,
          person: sel.fullName,
          email: sel.email,
          recordHref: `/admin/customers/${sel.id}`,
          // See V7CustomerDetail.editing: contacts are edited on the account's
          // own record, which is one click away, not in a second editor here.
          editing: false,
          editHref: `/admin/customers/${sel.id}`,
          doneEditHref: `/admin/customers/${sel.id}`,
          jobs: [],
          profiles: null,
          profilesNote:
            'Saved profiles are on the Find a past profile screen, which is the one profile search this app has.',
          jobsEmpty: 'Open the full record to see this customer’s jobs, orders and invoices.',
        }
      : null,
    filters: [
      { name: 'q', label: 'Search', value: filters.search, placeholder: 'Search name, company, or email…' },
      {
        name: 'role',
        label: 'Role',
        value: filters.role,
        options: [
          ['all', 'All roles'],
          ['admin', 'Admin'],
          ['contractor', 'Contractor'],
          ['architect', 'Architect'],
          ['customer', 'Customer'],
        ],
      },
      {
        name: 'tier',
        label: 'Pricing tier',
        value: filters.tier,
        options: [
          ['all', 'All tiers'],
          ['standard', 'Standard'],
          ['contractor', 'Contractor'],
          ['preferred', 'Preferred'],
          ['wholesale', 'Wholesale'],
        ],
      },
    ],
    showExport: true,
  };
}
