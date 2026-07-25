import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

interface CrmOrderUpdateInput {
  assignedDriverId?: string | null;
  deliveryScheduledAt?: string | null;
}

/**
 * Single write endpoint for the Command Center Orders (CRM) tab — handles
 * both [Assign Driver] and [Set Delivery Date], matching the same
 * single-PATCH-route-per-resource pattern already used by
 * app/api/admin/customers/[id]/route.ts.
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
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as CrmOrderUpdateInput;

    const { data: existing } = await supabase.from('orders').select('id').eq('id', params.id).maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ('assignedDriverId' in body) {
      if (body.assignedDriverId !== null && typeof body.assignedDriverId !== 'string') {
        return NextResponse.json({ error: 'Invalid driver id.' }, { status: 400 });
      }
      if (body.assignedDriverId) {
        const { data: driver } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', body.assignedDriverId)
          .maybeSingle();
        if (!driver || (driver.role !== 'operator' && driver.role !== 'admin')) {
          return NextResponse.json({ error: 'That user is not a valid driver.' }, { status: 400 });
        }
      }
      update.assigned_driver_id = body.assignedDriverId;
    }

    if ('deliveryScheduledAt' in body) {
      if (body.deliveryScheduledAt !== null && typeof body.deliveryScheduledAt !== 'string') {
        return NextResponse.json({ error: 'Invalid delivery date.' }, { status: 400 });
      }
      update.delivery_scheduled_at = body.deliveryScheduledAt;
    }

    const { error: updateError } = await supabase.from('orders').update(update).eq('id', params.id);
    if (updateError) {
      console.error('[CRM Order Update Error]', updateError);
      return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'update_order_crm_fields',
      resourceType: 'order',
      resourceId: params.id,
      afterValue: update,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRM Order Route Error]', error);
    return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
  }
}
