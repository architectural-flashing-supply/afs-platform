import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushProfileToPathfinder } from '@/lib/integrations/pathfinder-edge';
import {
  flashDraftToMachineProfile,
  type FlashDraftPointInput,
  type FlashDraftHemInput,
} from '@/lib/integrations/flashdraft-to-pathfinder';

// Catalog 20115 ("afs") — the only PathfinderEdge catalog the Thalmann
// DS2801 subscribes to, confirmed by Seth Oliver. Hardcoded, not
// configurable in the UI — matches app/api/admin/command-center/
// approve/route.ts's own AFS_MACHINE_CATALOG_ID. This route is entirely
// separate from that one and from machine_jobs/delivery_method — it
// sends whatever is currently drawn on the canvas directly, independent
// of the quote-request/job-approval pipeline.
const AFS_MACHINE_CATALOG_ID = '20115';

interface RequestBody {
  profileName?: string;
  points?: FlashDraftPointInput[];
  material?: string | null;
  thicknessIn?: number;
  hemStart?: FlashDraftHemInput | null;
  hemEnd?: FlashDraftHemInput | null;
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

    return NextResponse.json({ ok: true, profileId: result.profileId, message: result.message });
  } catch (error) {
    console.error('[Send to PathfinderEdge Error]', error);
    return NextResponse.json({ error: 'Could not send profile to PathfinderEdge. Please try again.' }, { status: 500 });
  }
}
