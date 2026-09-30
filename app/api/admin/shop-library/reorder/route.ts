import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * Manual shop-floor queue reordering (afs-cv-005), backing the Profile
 * Library table's up/down controls — see components/admin/
 * ProfileLibraryTable.tsx's moveRow for why up/down was chosen over
 * drag-and-drop.
 *
 * The client always sends the FULL ordered id list for every currently
 * active (non-deleted) row, not just the two rows that moved, and every id
 * in that list gets written 1..N here. That's required, not just tidy:
 * compareShopProfileLibraryQueueOrder (lib/data/shop-library.ts)
 * always sorts a null queue_position AFTER any explicit one, so a table with
 * a mix of explicit and null positions doesn't behave like a single ordered
 * list — a lone updated pair could jump ahead of untouched rows instead of
 * just swapping with its neighbor. Writing the whole set keeps it a gapless
 * sequence, the same reasoning lib/data/shop-library.ts's
 * appendToQueueEnd uses on the insert side.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const orderedIdsRaw = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).orderedIds : null;
    if (!Array.isArray(orderedIdsRaw) || orderedIdsRaw.length === 0 || orderedIdsRaw.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'orderedIds must be a non-empty array of row ids.' }, { status: 400 });
    }
    const orderedIds = orderedIdsRaw as string[];

    const { data: existing, error: fetchError } = await supabase
      .from('shop_profile_library')
      .select('id')
      .is('deleted_at', null);
    if (fetchError) {
      console.error('[Profile Library Reorder Fetch Error]', fetchError);
      return NextResponse.json({ error: 'Could not save the new queue order. Please try again.' }, { status: 500 });
    }

    const existingIds = new Set((existing ?? []).map((r) => r.id as string));
    const uniqueOrderedIds = new Set(orderedIds);
    const matchesActiveSet =
      uniqueOrderedIds.size === orderedIds.length &&
      existingIds.size === orderedIds.length &&
      orderedIds.every((id) => existingIds.has(id));
    if (!matchesActiveSet) {
      return NextResponse.json(
        { error: 'orderedIds must contain every active profile library row exactly once.' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      orderedIds.map((id, idx) => supabase.from('shop_profile_library').update({ queue_position: idx + 1 }).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('[Profile Library Reorder Update Error]', failed.error);
      return NextResponse.json({ error: 'Could not save the new queue order. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'reorder_shop_profile_library_queue',
      resourceType: 'shop_profile_library',
      resourceId: orderedIds[0],
      afterValue: { orderedIds },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Profile Library Reorder Route Error]', error);
    return NextResponse.json({ error: 'Could not save the new queue order. Please try again.' }, { status: 500 });
  }
}
