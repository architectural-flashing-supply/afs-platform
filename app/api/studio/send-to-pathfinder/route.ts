import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushProfileToPathfinder, AFS_MACHINE_CATALOG_ID } from '@/lib/integrations/pathfinder-edge';
import {
  flashDraftToMachineProfile,
  type FlashDraftPointInput,
  type FlashDraftHemInput,
} from '@/lib/integrations/flashdraft-to-pathfinder';
import { insertShopProfileLibraryRecord } from '@/lib/data/shop-profile-library';

// This route is entirely separate from app/api/admin/command-center/
// approve/route.ts and from machine_jobs/delivery_method — it sends
// whatever is currently drawn on the canvas directly, independent of the
// quote-request/job-approval pipeline.

interface RequestBody {
  profileName?: string;
  points?: FlashDraftPointInput[];
  material?: string | null;
  gauge?: string | null;
  thicknessIn?: number;
  quantity?: number | null;
  lengthFt?: number | null;
  notes?: string | null;
  hemStart?: FlashDraftHemInput | null;
  hemEnd?: FlashDraftHemInput | null;
  // Data-URI PNG snapshot of the FlashDraft canvas at the moment of send —
  // captured client-side via canvasRef.current.toDataURL('image/png') in
  // app/studio/draft/page.tsx's sendToPathfinder(). This IS FlashDraft's own
  // canvas-render code path (the same <canvas> the user is looking at), just
  // read back as pixels instead of redrawn — no separate rendering logic
  // exists or is written here. See shop_profile_library.geometry_svg
  // (migration 016, afs-sv-007) and afs-sv-009's task for why this is
  // captured on every send.
  geometryImage?: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Same admin gate as every other PathfinderEdge-touching route
    // (approve/route.ts, admin/pathfinder/push-profile/route.ts) — a
    // direct write to the real, machine-synced catalog is not something
    // a non-admin FlashDraft user (this page is otherwise public) should
    // be able to trigger.
    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as RequestBody;

    if (!Array.isArray(body.points) || body.points.length < 2) {
      return NextResponse.json({ error: 'Draw at least one segment (2 points) before sending.' }, { status: 400 });
    }
    if (typeof body.profileName !== 'string' || !body.profileName.trim()) {
      return NextResponse.json({ error: 'profileName is required.' }, { status: 400 });
    }

    const machineProfile = flashDraftToMachineProfile({
      profileName: body.profileName,
      points: body.points,
      material: body.material ?? null,
      thicknessIn: typeof body.thicknessIn === 'number' ? body.thicknessIn : 0,
      hemStart: body.hemStart ?? null,
      hemEnd: body.hemEnd ?? null,
    });

    const result = await pushProfileToPathfinder(machineProfile, AFS_MACHINE_CATALOG_ID);
    if (result.status !== 'connected') {
      return NextResponse.json({ error: result.message }, { status: 502 });
    }

    // Shop-floor record of this send (afs-sv-009) — never tied to a
    // quote_request/machine_job (this route has neither, per the file
    // header comment above), so customer/order fields stay null and only
    // what's actually available from the live draw session is captured.
    await insertShopProfileLibraryRecord(supabase, {
      profileName: body.profileName,
      material: body.material ?? null,
      gauge: body.gauge ?? null,
      quantity: typeof body.quantity === 'number' ? body.quantity : null,
      lengthFt: typeof body.lengthFt === 'number' ? body.lengthFt : null,
      accountNotes: body.notes ?? null,
      geometryPoints: body.points,
      geometrySvg: body.geometryImage ?? null,
      sourceTool: 'afs-flashdraft',
      pathfinderProfileId: result.profileId,
    });

    return NextResponse.json({ ok: true, profileId: result.profileId, message: result.message });
  } catch (error) {
    console.error('[Send to PathfinderEdge Error]', error);
    return NextResponse.json({ error: 'Could not send profile to PathfinderEdge. Please try again.' }, { status: 500 });
  }
}
