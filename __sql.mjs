import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const i = line.indexOf('='); if (i<1 || line.trim().startsWith('#')) continue;
  const k = line.slice(0,i).trim(); if (!process.env[k]) process.env[k] = line.slice(i+1).trim().replace(/^["']|["']$/g,'');
}
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
export async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${t.slice(0,500)}`);
  return JSON.parse(t);
}
