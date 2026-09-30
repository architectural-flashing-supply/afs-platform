import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { ...H, ...(init.headers||{}) } });
  const text = await r.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, body };
}

const V2_COLS = ['job_stage','stage_changed_at','approved_at','sent_to_machine_at','done_at','send_status','send_error','pathfinder_profile_ids','rush_source','rush_set_by','rush_set_at','source_tool','approval_channel','is_rush'];
console.log('=== A. migration 034 columns live on quote_requests ===');
for (const c of V2_COLS) {
  const { status, body } = await rest(`/quote_requests?select=${c}&limit=1`);
  console.log(`  ${status === 200 ? 'PRESENT' : 'MISSING'}  ${c}${status !== 200 ? '  -> ' + (body?.code||status) + ' ' + (body?.message||'') : ''}`);
}

console.log('\n=== B. RUSH CHECK constraint — behavioural proof (live INSERTs) ===');
const made = [];
async function tryInsert(label, patch) {
  const row = { status: 'submitted', line_items: [{ description: 'v2-02 verification row', quantity: 1 }], guest_email: 'v2-02-verify@example.com', ...patch };
  const { status, body } = await rest('/quote_requests', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  if (status >= 300) { console.log(`  REJECTED  ${label}\n              -> ${status} ${body?.code||''} ${(body?.message||'').slice(0,160)}`); return; }
  const rec = Array.isArray(body) ? body[0] : body;
  console.log(`  ACCEPTED  ${label}  (is_rush=${rec.is_rush}, rush_source=${rec.rush_source})`);
  made.push(rec.id);
}
await tryInsert('is_rush=true, rush_source=NULL              (a bare inference)', { request_number: 'V2VERIFY-A', is_rush: true, rush_source: null });
await tryInsert("is_rush=true, rush_source='inferred'        (invented source)", { request_number: 'V2VERIFY-B', is_rush: true, rush_source: 'inferred' });
await tryInsert("is_rush=true, rush_source='due_date'        (date inference)", { request_number: 'V2VERIFY-C', is_rush: true, rush_source: 'due_date' });
await tryInsert("is_rush=true, rush_source='keyword_asap'    (keyword inference)", { request_number: 'V2VERIFY-F', is_rush: true, rush_source: 'keyword_asap' });
await tryInsert("is_rush=true, rush_source='customer_checkbox'  (LEGAL)", { request_number: 'V2VERIFY-D', is_rush: true, rush_source: 'customer_checkbox' });
await tryInsert("is_rush=true, rush_source='admin_toggle'       (LEGAL)", { request_number: 'V2VERIFY-E', is_rush: true, rush_source: 'admin_toggle' });

console.log('\n=== C. the UPDATE path cannot sneak a rush in either ===');
if (made.length) {
  const { status, body } = await rest(`/quote_requests?id=eq.${made[0]}`, { method: 'PATCH', body: JSON.stringify({ is_rush: true, rush_source: null }) });
  console.log(`  PATCH is_rush=true, rush_source=NULL -> ${status >= 300 ? 'REJECTED ' + (body?.code||'') + ' ' + (body?.message||'').slice(0,130) : 'ACCEPTED — CONSTRAINT HOLE'}`);
}

console.log('\n=== D. cleanup — delete every row this script created ===');
for (const id of made) {
  const { status } = await rest(`/quote_requests?id=eq.${id}`, { method: 'DELETE' });
  console.log(`  delete ${id} -> ${status}`);
}
const a = await rest('/quote_requests?select=id,request_number&request_number=like.V2VERIFY*');
console.log(`  rows remaining with request_number LIKE 'V2VERIFY%': ${Array.isArray(a.body) ? a.body.length : JSON.stringify(a.body)}`);
const b = await rest('/quote_requests?select=id&guest_email=eq.v2-02-verify@example.com');
console.log(`  rows remaining with that guest_email: ${Array.isArray(b.body) ? b.body.length : JSON.stringify(b.body)}`);
