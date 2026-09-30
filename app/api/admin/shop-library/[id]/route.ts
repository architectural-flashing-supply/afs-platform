import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { isShopProfileLibraryStatus } from '@/lib/data/shop-library';
import { runShopJobCompletionAutomation } from '@/lib/utils/shop-job-completion';
import { autoScheduleDeliveryOnFinish } from '@/lib/delivery/auto-schedule';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Soft-delete only — sets deleted_at, never removes the row. Every read of
 * shop_profile_library (lib/data/shop-library.ts's
 * getShopProfileLibrary, and any future one, e.g. afs-sv-010's Shop View)
 * filters on `deleted_at IS NULL`, so this is enough to make a row disappear
 * everywhere without destroying the shop record.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
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

    const { data: existing } = await supabase
      .from('shop_profile_library')
      .select('id, deleted_at')
      .eq('id', params.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Profile library row not found.' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('shop_profile_library')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Profile Library Delete Error]', updateError);
      return NextResponse.json({ error: 'Could not delete this row. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'soft_delete_shop_profile_library_row',
      resourceType: 'shop_profile_library',
      resourceId: params.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Profile Library Delete Route Error]', error);
    return NextResponse.json({ error: 'Could not delete this row. Please try again.' }, { status: 500 });
  }
}

/**
 * Status advance, used by Shop View's (afs-sv-010) one-click
 * queued -> in_progress -> complete control. Lives on this same route
 * (rather than a separate shop-view-only API path) because it operates on
 * the exact same shop_profile_library row DELETE above does — one file per
 * resource id, one method per action on it. `isShopProfileLibraryStatus`
 * (lib/data/shop-library.ts) is the single source of truth for
 * which status strings are valid, shared with the client's own advance logic.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
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
    const status = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).status : null;
    if (!isShopProfileLibraryStatus(status)) {
      return NextResponse.json({ error: 'status must be one of: queued, in_progress, complete.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('shop_profile_library')
      .select('id, status, order_number, quote_request_id, started_at, deleted_at')
      .eq('id', params.id)
      .maybeSingle();
    if (!existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Profile library row not found.' }, { status: 404 });
    }

    // This is the actual completion write (afs-cv-004) — status and
    // completed_at land in the same UPDATE so a row can never be 'complete'
    // with a null completed_at. completed_at is purely an event-record
    // timestamp for the completion automation below to key off of.
    const nowIso = new Date().toISOString();
    const completedAt = status === 'complete' ? nowIso : null;
    // started_at (v2-04, migration 037) rides in the same UPDATE for the same
    // reason completed_at does: "Bending now" has to be able to say since
    // when. Only set on the first move into in_progress — re-advancing a job
    // that was already started must not reset its clock.
    const startedAt = status === 'in_progress' && existing.started_at == null ? nowIso : null;
    const updatePayload: { status: typeof status; completed_at?: string; started_at?: string } = {
      status,
      ...(completedAt !== null ? { completed_at: completedAt } : {}),
      ...(startedAt !== null ? { started_at: startedAt } : {}),
    };

    const { error: updateError } = await supabase
      .from('shop_profile_library')
      .update(updatePayload)
      .eq('id', params.id);
    if (updateError) {
      console.error('[Profile Library Status Update Error]', updateError);
      return NextResponse.json({ error: 'Could not update status. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'update_shop_profile_library_status',
      resourceType: 'shop_profile_library',
      resourceId: params.id,
      beforeValue: { status: existing.status },
      afterValue: { status, completed_at: completedAt },
    });

    // Same delivery-scheduling + invoice-email automation the mobile
    // field/shop "Mark Complete" route (app/api/field/shop/[id]/complete/
    // route.ts) fires on this exact transition — fires only on a genuine
    // -> 'complete' move, not on queued <-> in_progress advances.
    let message =
      status === 'in_progress'
        ? 'Started bending.'
        : status === 'complete'
          ? 'Marked finished.'
          : 'Put back in the queue.';
    let scheduledDate: string | null = null;
    let timeWindow: string | null = null;

    if (status === 'complete' && existing.status !== 'complete') {
      await runShopJobCompletionAutomation({
        shopProfileLibraryId: params.id,
        orderNumber: existing.order_number as string | null,
        quoteRequestId: existing.quote_request_id as string | null,
        completedBy: user.id,
      });

      // v2-04: Mark finished books the delivery for the next BUSINESS day and
      // tells the customer, through the services that already exist. The
      // service-role client is required — `deliveries`, `orders` and
      // `outbound_emails` are all admin-or-owner tables the notifier reads
      // across customers, and lib/supabase/admin.ts is the one client that
      // never reads a cached row (CLAUDE.md rule #22).
      const auto = await autoScheduleDeliveryOnFinish(createAdminClient(), {
        shopJobId: params.id,
        finishedBy: user.id,
      });
      scheduledDate = auto.scheduledDate;
      timeWindow = auto.timeWindow;
      // Already a full, plain-English sentence — see autoScheduleDeliveryOnFinish.
      message = auto.message;
    }

    return NextResponse.json({ ok: true, status, completedAt, message, scheduledDate, timeWindow });
  } catch (error) {
    console.error('[Profile Library Status Update Route Error]', error);
    return NextResponse.json({ error: 'Could not update status. Please try again.' }, { status: 500 });
  }
}
