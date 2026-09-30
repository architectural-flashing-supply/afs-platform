import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import {
  buildSearchArgs,
  SEARCH_FIELD_LABELS,
  SEARCH_FIELDS,
  type ProfileSearchResult,
  type SearchField,
} from '@/lib/data/profile-search';

/**
 * The Command Center's Search destination — the target of the header's search
 * box (Command Center V2 prompt v2-01, step 5).
 *
 * INTERIM BY DESIGN, and honest about it. The server side of search was built
 * and tested in commit 1646746: the parameterized Postgres function
 * `admin_profile_search` (migration 029) plus the typed normalization in
 * lib/data/profile-search.ts. What the approved prototype asks for on top of
 * that — a vertical thumbnail rail with a hover-intent enlarged preview, "/"
 * to focus, keyboard arrows, Recent and Pinned — is Phase 6 of the spec's own
 * build plan. This page is the plain, readable results list that makes the
 * header's Search box lead somewhere real in the meantime. Phase 6 replaces
 * the presentation, not the query.
 *
 * EGRESS: `admin_profile_search` never returns thumbnail_image, only
 * `hasThumbnail`. This list renders no images at all, so nothing base64
 * crosses the wire — the CLAUDE.md egress rule, satisfied by not asking.
 *
 * Admin-only twice over: the /admin tree's role gate, plus requireAdminUser
 * here, plus the SQL function re-checks admin itself.
 */
export const metadata: Metadata = {
  title: 'Search | AFS Command Center',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface SearchFnRow {
  id: string;
  name: string;
  company: string | null;
  person: string | null;
  profile_type: string | null;
  material: string | null;
  gauge: string | null;
  length_ft: number | null;
  quantity: number | null;
  created_at: string;
  geometry_fingerprint: string | null;
  same_shape_count: number;
  bend_count: number;
  hem_count: number;
  status: string | null;
  pathfinder_profile_id: string | null;
  has_thumbnail: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const get = (key: string): string | null => {
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  const query = (get('q') ?? '').trim();
  const field = (SEARCH_FIELDS.includes(get('field') as SearchField) ? get('field') : 'all') as SearchField;

  let results: ProfileSearchResult[] = [];
  let failed = false;

  if (query) {
    const { data, error } = await supabase.rpc('admin_profile_search', buildSearchArgs(get));
    if (error) {
      failed = true;
    } else {
      results = ((data ?? []) as SearchFnRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        company: row.company,
        person: row.person,
        profileType: row.profile_type,
        material: row.material,
        gauge: row.gauge,
        lengthFt: row.length_ft,
        quantity: row.quantity,
        createdAt: row.created_at,
        fingerprint: row.geometry_fingerprint,
        sameShapeCount: row.same_shape_count,
        bendCount: row.bend_count,
        hemCount: row.hem_count,
        status: row.status,
        pathfinderProfileId: row.pathfinder_profile_id,
        hasThumbnail: row.has_thumbnail,
      }));
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Search</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          {query ? (
            <>
              Profiles matching <span className="text-afs-chrome-high font-semibold">{query}</span>
              {field !== 'all' && <> in {SEARCH_FIELD_LABELS[field]}</>}.
            </>
          ) : (
            <>Type a customer, profile, or job in the search box at the top of the page.</>
          )}
        </p>
      </div>

      {failed && (
        <p className="font-body text-sm text-afs-crimson mb-6">
          Search could not run just now. Try again in a moment.
        </p>
      )}

      {query && !failed && results.length === 0 && (
        <p className="font-body text-sm text-afs-chrome-mid">
          Nothing matched <span className="text-afs-chrome-high font-semibold">{query}</span>. Try a shorter word, or
          part of a company name.
        </p>
      )}

      {results.length > 0 && (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-afs-border">
                {['Profile', 'Company', 'Person', 'Type', 'Spec', 'Made', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-afs-border last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/draft?admin=1&modifyProfile=${r.id}`}
                      className="font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors"
                    >
                      {r.name}
                    </Link>
                    {r.sameShapeCount > 1 && (
                      <span className="ml-2 font-label text-[10px] uppercase tracking-wide text-afs-chrome-high bg-afs-bg-surface border border-afs-chrome-base rounded px-1.5 py-0.5 whitespace-nowrap">
                        Same shape used {r.sameShapeCount}&times;
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid">{r.company ?? '—'}</td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid">{r.person ?? '—'}</td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid">{r.profileType ?? '—'}</td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid whitespace-nowrap">
                    {[r.material, r.gauge].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid whitespace-nowrap">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid whitespace-nowrap">
                    {r.status ?? '—'}
                    {r.pathfinderProfileId && (
                      <span className="block font-data text-xs text-afs-chrome-base">
                        #{r.pathfinderProfileId}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
