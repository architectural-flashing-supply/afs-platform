/**
 * End-of-run verification for the products-manifest branch.
 *
 * Checks, in order:
 *   (a) the manifest parses as JSON
 *   (b) every imageFiles path exists under public/
 *   (c) the entry count matches the inventory (75 files -> 64 entries after
 *       the edge-metal jpg/png pairing)
 *   (d) no entry has an invented geometryMatch: every non-null value must
 *       appear in the ProfileType union in lib/utils/profile-svg.ts, read
 *       from that file rather than copied here, so the check cannot go stale.
 *
 * Read-only. Exits non-zero on any failure.
 */
import { readFileSync, existsSync } from 'node:fs';

const MANIFEST = 'lib/data/product-renders.manifest.json';
const PROFILE_SVG = 'lib/utils/profile-svg.ts';
const EXPECTED_ENTRIES = 64;
const EXPECTED_FILES = 75;

const fail = [];
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { fail.push(m); console.log(`  FAIL  ${m}`); };

// (a) parses
let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  ok(`(a) ${MANIFEST} parses — ${manifest.length} entries`);
} catch (e) {
  bad(`(a) ${MANIFEST} does not parse: ${e.message}`);
  process.exit(1);
}

// (b) every image path exists under public/
let checked = 0;
const seen = new Set();
for (const e of manifest) {
  for (const p of e.imageFiles) {
    if (!p.startsWith('/images/products/')) bad(`(b) ${e.id}: path not under /images/products/: ${p}`);
    if (!p.endsWith('.webp')) bad(`(b) ${e.id}: not a .webp: ${p}`);
    const disk = `public${p}`;
    if (!existsSync(disk)) bad(`(b) ${e.id}: missing on disk: ${disk}`);
    checked += 1;
    seen.add(p);
  }
}
if (!fail.length) ok(`(b) all ${checked} image paths exist under public/ (${seen.size} distinct)`);
if (seen.size !== EXPECTED_FILES) bad(`(b) distinct files ${seen.size}, expected ${EXPECTED_FILES}`);
else ok(`(b) distinct file count ${seen.size} matches the inventory`);

// (c) entry count
if (manifest.length !== EXPECTED_ENTRIES) bad(`(c) entry count ${manifest.length}, expected ${EXPECTED_ENTRIES}`);
else ok(`(c) entry count ${manifest.length} matches the inventory (75 files, 11 edge-metal pairs)`);

// (d) no invented geometry
const src = readFileSync(PROFILE_SVG, 'utf8');
const union = src.slice(src.indexOf('export type ProfileType ='), src.indexOf(';', src.indexOf('export type ProfileType =')));
const allowed = new Set([...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));
if (allowed.size === 0) bad('(d) could not read the ProfileType union — check failed open, not passed');
const used = manifest.filter((e) => e.geometryMatch).map((e) => e.geometryMatch);
const invented = [...new Set(used)].filter((g) => !allowed.has(g));
if (invented.length) bad(`(d) invented geometryMatch values: ${invented.join(', ')}`);
else ok(`(d) all ${used.length} geometryMatch values are real ProfileType members (union has ${allowed.size})`);

// required fields
const FIELDS = ['id','type','sourceName','description','category','subcategory','imageFiles','geometryMatch','needsReview'];
for (const e of manifest) {
  for (const f of FIELDS) if (!(f in e)) bad(`schema: ${e.id ?? '<no id>'} missing field "${f}"`);
  if (e.needsReview && !e.reviewNote) bad(`schema: ${e.id} is needsReview with no reviewNote`);
}
const ids = manifest.map((e) => e.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) bad(`schema: duplicate ids: ${[...new Set(dupes)].join(', ')}`);
if (!fail.length) ok('schema: every entry has all required fields, unique ids, notes on every review flag');

console.log(fail.length ? `\n${fail.length} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(fail.length ? 1 : 0);
