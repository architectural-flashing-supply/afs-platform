import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const q = async (p) => { const r = await fetch(BASE+p,{headers:H}); return { status:r.status, body: await r.json().catch(()=>null) }; };

console.log('=== rows left behind by any v2-02 test run ===');
for (const [label, path] of [
  ["quote_requests notes LIKE 'V2-02-E2E-WORKBENCH%'", "/quote_requests?select=id,request_number,notes&notes=like.*V2-02-E2E-WORKBENCH*"],
  ["quote_requests job_name LIKE 'V2-02-E2E-WORKBENCH%'", "/quote_requests?select=id,request_number&job_name=like.*V2-02-E2E-WORKBENCH*"],
  ["quote_requests request_number LIKE 'V2VERIFY%'", "/quote_requests?select=id&request_number=like.V2VERIFY*"],
  ["quote_requests guest_email = v2-02-verify@example.com", "/quote_requests?select=id&guest_email=eq.v2-02-verify@example.com"],
  ["machine_jobs notes/name tagged", "/machine_jobs?select=id,job_name&job_name=like.*V2-02-E2E-WORKBENCH*"],
]) {
  const { status, body } = await q(path);
  console.log(`  ${label}: ${status===200 ? (Array.isArray(body)?body.length:'?') + ' row(s)' : 'status ' + status + ' ' + JSON.stringify(body).slice(0,120)}`);
  if (Array.isArray(body) && body.length) console.log('     ', JSON.stringify(body).slice(0,400));
}

console.log('\n=== PathfinderEdge push audit rows in the last 2 hours (must be none) ===');
const since = new Date(Date.now() - 2*3600*1000).toISOString();
const { status, body } = await q(`/admin_audit_log?select=action,created_at,detail&created_at=gte.${since}&order=created_at.desc&limit=50`);
if (status !== 200) { console.log('  audit query status', status, JSON.stringify(body).slice(0,200)); }
else {
  const pushRows = body.filter(r => /to_machine|pathfinder/i.test(r.action||''));
  console.log(`  audit rows in window: ${body.length}`);
  console.log(`  rows whose action mentions to_machine/pathfinder: ${pushRows.length}`);
  for (const r of pushRows) console.log('    !!', r.action, r.created_at);
  const actions = [...new Set(body.map(r=>r.action))];
  console.log('  distinct actions seen:', JSON.stringify(actions));
}
