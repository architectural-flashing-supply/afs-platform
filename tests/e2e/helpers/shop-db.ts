import { sql } from './db';

/**
 * v2-04 — SQL HELPERS FOR THE SHOP QUEUE AND THE DELIVERIES WEEK. Companion to
 * ./db.ts (jobs) and ./pricing-db.ts (quotes, invoices, the ledger), reusing
 * ./db.ts's Supabase Management API transport.
 *
 * ================== WHY A SHOP ROW IS INSERTED BY SQL ==================
 *
 * The only real way a `shop_profile_library` row appears is a genuine "Send to
 * machine" — which POSTs a profile into PathfinderEdge catalog 20115, which is
 * polled by the physical Thalmann. A test must never do that. So the Job is
 * submitted through the REAL public API (see the spec's `submitJob`), and only
 * the two things a real send would have written behind it — the Job's stage and
 * its shop row — are written here. Nothing in this file or in the spec makes a
 * request to the machine integration; the static single-door test
 * (lib/integrations/pathfinder-single-door.test.ts) is what enforces that.
 *
 * Same reasoning ./db.ts's `forceStage` was written under, and the same reason
 * there is no /api/admin/e2e-* route: a test harness does not get to add a door.
 *
 * ================== THE RESERVED PREFIX DOES THE WORK ==================
 *
 * Every fixture's `job_name` starts with `E2E-TEST-` (lib/pricing/ledger.ts's
 * LEDGER_TEST_TAG_PREFIX), which is what makes lib/email/outbound.ts CAPTURE
 * the delivery notification instead of sending it, keeps Twilio out of it
 * entirely (lib/delivery/notify.ts), and stamps `deliveries.test_tag` so the
 * cleanup below can find every row it created.
 *
 * THIS FILE MAKES NO OUTBOUND REQUEST EXCEPT THE SUPABASE SQL POST INSIDE
 * ./db.ts's `sql()`. Deliberately, it never spells the bend-machine vendor's
 * name as one word — see ./db.ts's header for why that matters.
 */

/** A uuid, checked before it is ever interpolated into SQL. */
function uuid(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`not a uuid: ${id}`);
  return id;
}

/** A safe SQL string literal — every free-text value below goes through this. */
function lit(value: string): string {
  if (!/^[A-Za-z0-9 ._:@#/+-]{1,200}$/.test(value)) throw new Error(`unsafe literal: ${value}`);
  return `'${value}'`;
}

/** A `YYYY-MM-DD` date, checked before interpolation. */
function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`not a date: ${value}`);
  return `'${value}'`;
}

export interface ShopJobFixture {
  shopJobId: string;
  quoteRequestId: string;
  profileName: string;
  queuePosition: number;
}

/**
 * Puts a Job in the shop lane and gives it the one shop row a real send would
 * have written.
 *
 * `queuePosition` is set explicitly and high (9000+) so a fixture never
 * reorders the real queue, and so the rush-pinning assertion is unambiguous: a
 * rush fixture at position 9002 has to render ABOVE a normal fixture at 9001
 * AND above every real row, or rule #15 is not being applied here.
 */
export async function createShopJobFixture(
  tag: string,
  quoteRequestId: string,
  opts: {
    label: string;
    queuePosition: number;
    customerEmail: string;
    company?: string;
    quantity?: number;
    machineProfileId?: string;
  }
): Promise<ShopJobFixture> {
  const profileName = `${tag}-${opts.label}`;
  await sql(
    `update quote_requests
        set job_stage = 'shop', stage_changed_at = now(), sent_to_machine_at = now(),
            job_name = ${lit(profileName)}
      where id = '${uuid(quoteRequestId)}';`
  );
  const rows = await sql<{ id: string }>(
    `insert into shop_profile_library
       (quote_request_id, profile_name, customer_name, company, customer_email, material, gauge,
        quantity, length_ft, status, queue_position, pathfinder_profile_id, source_tool, job_name)
     values ('${uuid(quoteRequestId)}', ${lit(profileName)}, ${lit('E2E Forge')},
             ${lit(opts.company ?? 'E2E Forge Testing')}, ${lit(opts.customerEmail)},
             ${lit(`${tag}-MATERIAL`)}, ${lit(`${tag}-GAUGE`)},
             ${Math.max(1, Math.round(opts.quantity ?? 7))}, 10, 'queued',
             ${Math.round(opts.queuePosition)},
             ${opts.machineProfileId ? lit(opts.machineProfileId) : 'null'},
             ${lit('afs-flashdraft')}, ${lit(profileName)})
     returning id;`
  );
  return {
    shopJobId: rows[0].id,
    quoteRequestId,
    profileName,
    queuePosition: Math.round(opts.queuePosition),
  };
}

/** Marks a Job rush the way the admin toggle does — explicit source, as rule #15 requires. */
export async function setFixtureRush(quoteRequestId: string): Promise<void> {
  await sql(
    `update quote_requests
        set is_rush = true, rush_source = 'admin_toggle', rush_set_at = now()
      where id = '${uuid(quoteRequestId)}';`
  );
}

export interface ShopRowState {
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  queue_position: number | null;
}

export async function readShopRow(shopJobId: string): Promise<ShopRowState> {
  const rows = await sql<ShopRowState>(
    `select status, started_at, completed_at, queue_position
       from shop_profile_library where id = '${uuid(shopJobId)}';`
  );
  if (!rows.length) throw new Error(`no shop_profile_library ${shopJobId}`);
  return rows[0];
}

export interface DeliveryRowState {
  id: string;
  scheduled_date: string;
  time_window: string;
  status: string;
  auto_scheduled: boolean;
  delivered_at: string | null;
  notified_at: string | null;
  notify_note: string | null;
  test_tag: string | null;
}

export async function readDeliveryForShopJob(shopJobId: string): Promise<DeliveryRowState | null> {
  const rows = await sql<DeliveryRowState>(
    `select id, scheduled_date::text as scheduled_date, time_window, status, auto_scheduled,
            delivered_at, notified_at, notify_note, test_tag
       from deliveries where shop_job_id = '${uuid(shopJobId)}';`
  );
  return rows[0] ?? null;
}

/**
 * The next business day after a given date, computed BY POSTGRES rather than by
 * the code under test.
 *
 * This is what makes the Friday-finish assertion real: the expected answer
 * comes from `date_trunc`/`extract(dow)` in the database, so the spec is not
 * checking lib/delivery/business-days.ts against itself.
 */
export async function nextBusinessDayInDatabase(from: string): Promise<string> {
  const rows = await sql<{ next: string }>(
    `with d as (select ${dateOnly(from)}::date + 1 as x)
     select (case extract(dow from x)
               when 0 then x + 1   -- Sunday    -> Monday
               when 6 then x + 2   -- Saturday  -> Monday
               else x
             end)::text as next
       from d;`
  );
  return rows[0].next;
}

/** Forces a finish date on the shop row so the Friday case can be exercised for real. */
export async function backdateFinish(shopJobId: string, isoInstant: string): Promise<void> {
  if (Number.isNaN(Date.parse(isoInstant))) throw new Error(`not a timestamp: ${isoInstant}`);
  await sql(
    `update shop_profile_library set completed_at = '${new Date(isoInstant).toISOString()}'
      where id = '${uuid(shopJobId)}';`
  );
}

/** Moves a delivery onto a given day, so the week view can be asserted on a known date. */
export async function moveDelivery(deliveryId: string, day: string): Promise<void> {
  await sql(
    `update deliveries set scheduled_date = ${dateOnly(day)}::date, updated_at = now()
      where id = '${uuid(deliveryId)}';`
  );
}

/**
 * Deletes everything this spec created in the shop and delivery tables.
 *
 * `deliveries.shop_job_id` is ON DELETE CASCADE, so removing the shop row takes
 * its delivery with it — but the delivery is deleted explicitly first anyway,
 * so the count assertion afterwards is testing a real deletion rather than a
 * cascade nobody looked at. `notifications` rows are swept by ./db.ts's
 * `deleteTestNotifications`, which scopes by recipient and a time floor.
 */
export async function deleteShopFixtures(tag: string): Promise<void> {
  // `test_tag` is written by ledgerTestTag(), which takes the FIRST
  // whitespace-delimited word of the job name — and a fixture's job name is a
  // single hyphenated word, so the tag is `E2E-TEST-V2-04-JOURNEY`, not the
  // bare prefix. Matching on the prefix rather than on equality is therefore
  // the difference between a real sweep and a vacuous one.
  const fixtureRows = `select id from shop_profile_library where job_name like '${tag}%'`;
  const fixtureDeliveries = `select id from deliveries where test_tag like '${tag}%' or shop_job_id in (${fixtureRows})`;

  // Audit rows FIRST, while the rows they point at still exist, so the scope
  // is "this spec's ids" and never "anything that failed to resolve".
  // resource_id is a uuid column, so these compare uuid to uuid.
  await sql(
    `delete from admin_audit_log
      where resource_type = 'delivery' and resource_id in (${fixtureDeliveries});`
  );
  await sql(
    `delete from admin_audit_log
      where resource_type = 'shop_profile_library' and resource_id in (${fixtureRows});`
  );
  await sql(`delete from completion_events where shop_profile_library_id in (${fixtureRows});`);
  await sql(`delete from deliveries where test_tag like '${tag}%';`);
  await sql(`delete from deliveries where shop_job_id in (${fixtureRows});`);
  await sql(`delete from shop_profile_library where job_name like '${tag}%';`);
}

/** Fixture rows still present anywhere this spec wrote. Every count must be 0. */
export async function remainingShopFixtures(tag: string): Promise<{
  shopRows: number;
  deliveries: number;
  completionEvents: number;
  orphanAuditRows: number;
}> {
  const rows = await sql<{
    shopRows: number;
    deliveries: number;
    completionEvents: number;
    orphanAuditRows: number;
  }>(
    `select
       (select count(*)::int from shop_profile_library where job_name like '${tag}%') as "shopRows",
       (select count(*)::int from deliveries where test_tag like '${tag}%') as "deliveries",
       (select count(*)::int from completion_events ce
          where exists (select 1 from shop_profile_library s
                         where s.id = ce.shop_profile_library_id
                           and s.job_name like '${tag}%')) as "completionEvents",
       (select count(*)::int from admin_audit_log a
          where a.resource_type in ('delivery', 'shop_profile_library')
            and a.created_at > now() - interval '6 hours'
            and not exists (select 1 from deliveries d where d.id = a.resource_id)
            and not exists (select 1 from shop_profile_library s where s.id = a.resource_id))
         as "orphanAuditRows";`
  );
  return rows[0];
}
