/**
 * ONE-OFF, READ-ONLY audit script for GEOMETRY_AUDIT.md. Plain CommonJS so it
 * can run under plain `node` without tsx. Makes zero writes.
 */
const { readFileSync } = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { WebSocket } = require('ws');

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

function loadEnvLocal() {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // assume env already set
  }
}
loadEnvLocal();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: bendCounts, error: bcErr } = await supabase
    .from('machine_profile_bends')
    .select('profile_id')
    .order('profile_id');
  if (bcErr) {
    console.error('bend count query error', bcErr);
    return;
  }
  const counts = new Map();
  for (const row of bendCounts ?? []) {
    counts.set(row.profile_id, (counts.get(row.profile_id) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => a[1] - b[1]);
  console.log(`Total profiles with bends: ${sorted.length}`);
  console.log(`Bend-count distribution: min=${sorted[0]?.[1]}, max=${sorted[sorted.length - 1]?.[1]}`);

  const picks = [
    sorted[0],
    sorted[Math.floor(sorted.length * 0.25)],
    sorted[Math.floor(sorted.length * 0.5)],
    sorted[Math.floor(sorted.length * 0.75)],
    sorted[sorted.length - 1],
  ].filter(Boolean);

  for (const [profileId, bendCount] of picks) {
    const { data: profile } = await supabase
      .from('machine_profiles')
      .select('id, source_profile_id, profile_number, name_en, name_original, is_public, blank_width_mm, blank_width_in')
      .eq('id', profileId)
      .single();
    const { data: bends } = await supabase
      .from('machine_profile_bends')
      .select('step_number, left_leg_mm, right_leg_mm, left_leg_in, right_leg_in, bend_angle_degrees, radius_mm, radius_in')
      .eq('profile_id', profileId)
      .order('step_number', { ascending: true });

    console.log('\n=========================================');
    console.log(`Profile: ${profile?.name_en} (#${profile?.profile_number}, source_id=${profile?.source_profile_id})`);
    console.log(`  is_public=${profile?.is_public}  bendCount=${bendCount}  blankWidth=${profile?.blank_width_in}in / ${profile?.blank_width_mm}mm`);
    console.log(`  name_original: ${profile?.name_original}`);
    console.log('  Bends:');
    for (const b of bends ?? []) {
      console.log(
        `    step ${b.step_number}: leftLeg=${b.left_leg_in}in (${b.left_leg_mm}mm)  rightLeg=${b.right_leg_in}in (${b.right_leg_mm}mm)  angle=${b.bend_angle_degrees}deg  radius=${b.radius_in}in`
      );
    }

    const bendRows = bends ?? [];
    const points = [{ x: 0, y: 0 }];
    let heading = 0;
    let current = { x: 0, y: 0 };
    for (const bend of bendRows) {
      const legLength = bend.left_leg_in ?? 0;
      current = {
        x: current.x + Math.cos((heading * Math.PI) / 180) * legLength,
        y: current.y + Math.sin((heading * Math.PI) / 180) * legLength,
      };
      points.push(current);
      const angle = bend.bend_angle_degrees ?? 180;
      heading += 180 - angle;
    }
    if (bendRows.length > 0) {
      const last = bendRows[bendRows.length - 1];
      const legLength = last.right_leg_in ?? 0;
      current = {
        x: current.x + Math.cos((heading * Math.PI) / 180) * legLength,
        y: current.y + Math.sin((heading * Math.PI) / 180) * legLength,
      };
      points.push(current);
    }
    console.log('  Reconstructed points (inches):');
    points.forEach((p, i) => console.log(`    [${i}] x=${p.x.toFixed(3)}  y=${p.y.toFixed(3)}`));

    let pathLen = 0;
    for (let i = 1; i < points.length; i++) {
      pathLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    console.log(`  Total path length: ${pathLen.toFixed(3)}in`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
