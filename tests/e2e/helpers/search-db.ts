import { sql } from './db';

/**
 * v2-05 — SQL HELPERS FOR THE PROFILE-SEARCH FIXTURES. Companion to ./db.ts
 * (jobs), ./pricing-db.ts (quotes and the ledger) and ./shop-db.ts (the shop
 * queue), reusing ./db.ts's Supabase Management API transport.
 *
 * WHY NOT supabase-js, WHICH modify-in-flashdraft.spec.ts USES. That client
 * constructs a realtime client on creation, and realtime needs a global
 * WebSocket — which Node 20 (the version this repo runs) does not have. The
 * failure is at `createClient`, before a single query, so it is not something
 * the spec can work around. Every v2 spec goes through `sql()` instead, and
 * this one now does too.
 *
 * EVERY ROW THIS FILE WRITES IS OWNED BY THE E2E TEST USER and named with the
 * `E2E-SEARCH` prefix, which is how the sweep finds anything an assertion
 * failed before tracking.
 *
 * THIS FILE MAKES NO OUTBOUND REQUEST EXCEPT THE SUPABASE SQL POST INSIDE
 * ./db.ts's `sql()`. It touches no machine integration of any kind.
 */

/** A uuid, checked before it is ever interpolated into SQL. */
function uuid(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`not a uuid: ${id}`);
  return id;
}

/** A safe SQL string literal — every free-text value below goes through this. */
function lit(value: string): string {
  if (!/^[A-Za-z0-9 ._:@#/-]{1,200}$/.test(value)) throw new Error(`unsafe literal: ${value}`);
  return `'${value}'`;
}

/** An ISO timestamp, checked before it is ever interpolated into SQL. */
function timestamp(value: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`not a timestamp: ${value}`);
  return `'${new Date(value).toISOString()}'`;
}

/**
 * A JSON value as a dollar-quoted SQL literal. The tag is checked against the
 * serialized text so the quoting can never be closed early by the content.
 */
function json(value: unknown): string {
  const text = JSON.stringify(value);
  if (text.includes('$fx$')) throw new Error('json payload contains the dollar-quote tag');
  return `$fx$${text}$fx$::jsonb`;
}

export const SEARCH_PREFIX = 'E2E-SEARCH';

/** A real, tiny PNG — enough to prove a thumbnail arrived by its own request. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** A plain L — a real drawing with one real bend. */
export const FIXTURE_POINTS = [
  { x: -6, y: -3 },
  { x: 4, y: -3 },
  { x: 4, y: 5 },
];

export interface SearchFixture {
  id: string;
  name: string;
}

export async function findUserId(email: string): Promise<string> {
  const rows = await sql<{ id: string }>(
    `select id from profiles where email = ${lit(email)} limit 1;`
  );
  if (!rows.length) throw new Error(`no profile for ${email}`);
  return rows[0].id;
}

export interface SearchFixtureSpec {
  name: string;
  company: string;
  person: string;
  profileType: string;
  material: string;
  gauge: string;
  thumbnail?: boolean;
  fingerprint?: string | null;
}

/**
 * EVERY FIXTURE IN ONE STATEMENT. The Management API's SQL endpoint is rate
 * limited, and thirteen separate inserts per run tripped it — four tests
 * failed on `ThrottlerException` before a single assertion ran, which looks
 * exactly like a broken feature. This endpoint accepts a multi-row INSERT, so
 * setup is now one call.
 *
 * The rows come back in `name` order rather than in the order given: RETURNING
 * has no ordering guarantee, and a caller that picks `rows[0]` and gets a
 * different fixture than it asked for would be a maddening flake.
 */
export async function insertSearchFixtures(
  userId: string,
  specs: SearchFixtureSpec[]
): Promise<SearchFixture[]> {
  for (const spec of specs) {
    if (!spec.name.startsWith(SEARCH_PREFIX)) {
      throw new Error(`fixture names must start with ${SEARCH_PREFIX}: ${spec.name}`);
    }
  }
  const values = specs
    .map((spec) => {
      const jobInfo = {
        clientBusinessName: spec.company,
        clientName: spec.person,
        poNumber: `${SEARCH_PREFIX}-PO`,
        jobName: `${SEARCH_PREFIX} job`,
      };
      const dimensions = {
        kind: 'flashdraft',
        points: FIXTURE_POINTS,
        hemStart: null,
        hemEnd: null,
        revision: 1,
        material: spec.material,
        gauge: spec.gauge,
      };
      return `(
        '${uuid(userId)}',
        ${lit(spec.name)},
        10,
        2,
        ${lit(`${SEARCH_PREFIX} fixture`)},
        ${lit(spec.profileType)},
        ${spec.fingerprint ? lit(spec.fingerprint) : 'null'},
        ${spec.thumbnail ? `'${TINY_PNG}'` : 'null'},
        ${json(jobInfo)},
        ${json(dimensions)}
      )`;
    })
    .join(', ');

  const rows = await sql<SearchFixture>(
    `insert into saved_configurations
       (user_id, name, length_ft, quantity, notes, profile_type, geometry_fingerprint,
        thumbnail_image, job_info, dimensions)
     values ${values}
     returning id, name;`
  );
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

/** Profiles this user owns that were created since the spec started. */
export async function profilesCreatedSince(userId: string, sinceIso: string): Promise<{ id: string; name: string }[]> {
  return sql<{ id: string; name: string }>(
    `select id, name from saved_configurations
      where user_id = '${uuid(userId)}' and created_at >= ${timestamp(sinceIso)}
      order by created_at;`
  );
}

/**
 * Deletes everything this spec caused, scoped twice over: to the E2E user,
 * and to the window this run happened in. A real customer's row is never in
 * range — a real customer is never the E2E account.
 */
export async function deleteSearchFixtures(userId: string, sinceIso: string): Promise<void> {
  const u = uuid(userId);
  // One call, three statements — see insertSearchFixtures on why call count
  // matters here. Shortcut rows go first so the FK cascade has nothing left
  // to do, and the result is the same either way.
  await sql(
    `delete from admin_recent_profiles where admin_id = '${u}';
     delete from admin_pinned_profiles where admin_id = '${u}';
     delete from saved_configurations
      where user_id = '${u}'
        and (name like '${SEARCH_PREFIX}%' or created_at >= ${timestamp(sinceIso)});`
  );
}

/**
 * Deletes AUTO-NAMED Passport rows this run caused — the ones FlashDraft
 * writes with `generateAutoProfileName()` when a drawing has no name of its
 * own (`Profile-<ISO timestamp>`).
 *
 * WHY IT IS HERE AND NOT ONLY IN THE SEARCH SPEC. flashdraft.spec.ts's "Lock
 * Profile & Save to Passport" test has written one of these on every run since
 * it was gated on real credentials, and never deleted it — found live on
 * 2026-09-30 when a v2-05 cleanup check showed `saved_configurations` holding
 * exactly one row nobody had asked for. "Every row the tests create is
 * deleted" was therefore not true of that spec, and a table nobody counts is
 * exactly where that kind of claim rots.
 *
 * Scoped twice over: to the E2E user, and to rows created since the run
 * started. A real customer's profile is never in range — a real customer is
 * never the E2E account, and a real profile is not called `Profile-<ISO>`.
 */
export async function deleteAutoNamedProfiles(userId: string, sinceIso: string): Promise<number> {
  const rows = await sql<{ id: string }>(
    `delete from saved_configurations
      where user_id = '${uuid(userId)}'
        and created_at >= ${timestamp(sinceIso)}
        and name like 'Profile-%'
      returning id;`
  );
  return rows.length;
}

/** Rows this spec could still own. Must be 0 after cleanup. */
export async function remainingSearchRows(
  userId: string,
  sinceIso: string
): Promise<{ profiles: number; recent: number; pinned: number }> {
  const u = uuid(userId);
  const rows = await sql<{ profiles: number; recent: number; pinned: number }>(
    `select
       (select count(*)::int from saved_configurations
         where user_id = '${u}'
           and (name like '${SEARCH_PREFIX}%' or created_at >= ${timestamp(sinceIso)})) as profiles,
       (select count(*)::int from admin_recent_profiles where admin_id = '${u}') as recent,
       (select count(*)::int from admin_pinned_profiles where admin_id = '${u}') as pinned;`
  );
  return rows[0];
}
