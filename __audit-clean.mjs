import { sql } from './__sql.mjs';
// Narrow on purpose: only audit rows from the test window whose quote_request
// no longer exists. A row pointing at a live job is never touched.
const del = await sql(`
  delete from admin_audit_log a
  where a.created_at > now() - interval '6 hours'
    and a.resource_type = 'quote_request'
    and not exists (select 1 from quote_requests q where q.id = a.resource_id)
  returning a.id, a.action;`);
console.log('deleted orphaned audit rows:', del.length);
for (const r of del) console.log('  ', r.action, r.id);
const left = await sql(`
  select count(*)::int as n from admin_audit_log a
  where a.created_at > now() - interval '6 hours'
    and not exists (select 1 from quote_requests q where q.id = a.resource_id);`);
console.log('orphaned audit rows remaining in window:', left[0].n);
