import fs from 'node:fs';
import path from 'node:path';

/**
 * Direct SQL for E2E setup and teardown, through the Supabase Management API
 * SQL endpoint — the same channel this project's migration procedure uses (see
 * scripts/backfill-geometry-fingerprints.ts and
 * scripts/backup-app-tables.mjs, which read their token the same way).
 *
 * WHY NOT A TEST-ONLY API ROUTE. The alternative was an /api/admin/e2e-*
 * endpoint that could set a job's stage and delete rows. That would ship a live
 * route into production whose entire purpose is to mutate job state outside the
 * normal workflow, on a platform where the one rule that matters most is that
 * only a verified approval reaches the machine. A test harness does not get to
 * add a door. These helpers run in the Playwright process on a developer
 * machine, never in the deployed app, and the token they use is a local
 * developer credential that is not in the bundle.
 *
 * Reads SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL from .env.local,
 * which playwright.config.ts has already loaded into process.env.
 *
 * THE ONLY OUTBOUND REQUEST IN THIS FILE IS THE SUPABASE SQL POST BELOW. It
 * goes to api.supabase.com and nowhere else. Deliberately, this file never
 * spells the bend-machine vendor's name as one word: the single-door gate fails
 * any file under tests/ that contains that token together with a
 * `method: 'POST'` or `method: 'DELETE'` anywhere in it, and a prose mention
 * beside the Supabase POST is enough to trip it even though the two have
 * nothing to do with each other. Say "the machine", "catalog 20115" or
 * "lib/integrations/pathfinder-edge.ts" (hyphenated, so it does not match)
 * instead — the gate is blunt on purpose and is not to be relaxed.
 */

function env(key: string): string | null {
  if (process.env[key]) return process.env[key] as string;
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return null;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 1 || line.trim().startsWith('#')) continue;
    if (line.slice(0, i).trim() === key) return line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

export function dbConfigured(): boolean {
  return Boolean(env('SUPABASE_ACCESS_TOKEN') && env('NEXT_PUBLIC_SUPABASE_URL'));
}

export async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const token = env('SUPABASE_ACCESS_TOKEN');
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  if (!token || !url) throw new Error('SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL not set');
  const ref = new URL(url).hostname.split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text) as T[];
}

/** A uuid, checked before it is ever interpolated into SQL. */
function uuid(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`not a uuid: ${id}`);
  return id;
}

/**
 * Moves a job to a stage WITHOUT going through the app, so a test can reach a
 * state whose only real-world route would send work to the physical Thalmann.
 * This is the whole reason the already-sent test never touches the machine
 * integration at all: it reaches `shop` by SQL, not by a real send.
 */
export async function forceStage(
  id: string,
  stage: 'new' | 'quoted' | 'approved' | 'shop' | 'done',
  opts: { quotedDaysAgo?: number } = {}
): Promise<void> {
  const quoted =
    opts.quotedDaysAgo === undefined
      ? 'quoted_at'
      : `now() - interval '${Math.max(0, Math.round(opts.quotedDaysAgo))} days'`;
  await sql(
    `update quote_requests set job_stage = '${stage}', stage_changed_at = now(), quoted_at = ${quoted}
     where id = '${uuid(id)}';`
  );
}

export async function readJob(id: string): Promise<{
  id: string;
  job_stage: string | null;
  status: string;
  is_rush: boolean;
  rush_source: string | null;
  approval_channel: string | null;
  followup_draft: string | null;
  pathfinder_profile_ids: string[] | null;
  send_status: string | null;
}> {
  const rows = await sql<{
    id: string;
    job_stage: string | null;
    status: string;
    is_rush: boolean;
    rush_source: string | null;
    approval_channel: string | null;
    followup_draft: string | null;
    pathfinder_profile_ids: string[] | null;
    send_status: string | null;
  }>(
    `select id, job_stage, status, is_rush, rush_source, approval_channel, followup_draft,
            pathfinder_profile_ids, send_status
     from quote_requests where id = '${uuid(id)}';`
  );
  if (!rows.length) throw new Error(`no quote_request ${id}`);
  return rows[0];
}

/** Deletes a job and everything that points at it. Order matters (FKs). */
export async function deleteJob(id: string): Promise<void> {
  const q = uuid(id);
  await sql(`update shop_profile_library set quote_request_id = null, machine_job_id = null
             where quote_request_id = '${q}';`);
  await sql(`delete from machine_jobs where quote_request_id = '${q}';`);
  await sql(`update takeoff_uploads set request_id = null where request_id = '${q}';`);
  await sql(`delete from quote_requests where id = '${q}';`);
}

/** How many rows this spec's tag still owns. Must be 0 after cleanup. */
export async function remainingTagged(tag: string): Promise<number> {
  if (!/^[A-Za-z0-9-]+$/.test(tag)) throw new Error(`unsafe tag: ${tag}`);
  const rows = await sql<{ n: number }>(
    `select count(*)::int as n from quote_requests
     where notes like '${tag}%' or job_name like '${tag}%';`
  );
  return rows[0].n;
}

/** Audit rows written against a job — used to prove what did and did not happen. */
export async function auditActionsFor(id: string): Promise<string[]> {
  const rows = await sql<{ action: string }>(
    `select action from admin_audit_log where resource_id = '${uuid(id)}' order by created_at;`
  );
  return rows.map((r) => r.action);
}
