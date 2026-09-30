import { sql } from './__sql.mjs';
const rows = await sql(`
  select a.id, a.action, a.resource_type, a.resource_id, a.created_at,
         (q.id is not null) as job_still_exists
  from admin_audit_log a
  left join quote_requests q on q.id = a.resource_id
  where a.created_at > now() - interval '6 hours'
  order by a.created_at;`);
console.log('audit rows in last 6h:', rows.length);
const orphans = rows.filter(r => !r.job_still_exists);
console.log('orphaned (their quote_request is gone):', orphans.length);
console.log('still pointing at a live job:', rows.length - orphans.length);
console.log('\nby action:');
for (const a of [...new Set(rows.map(r=>r.action))]) {
  const all = rows.filter(r=>r.action===a);
  console.log(`  ${a}: ${all.length} total, ${all.filter(r=>!r.job_still_exists).length} orphaned`);
}
console.log('\nany row still pointing at a live job:');
for (const r of rows.filter(r=>r.job_still_exists)) console.log('  ', JSON.stringify(r));
