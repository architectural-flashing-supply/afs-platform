import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { parseAdminNotes, type AdminOrderNote } from '@/lib/data/orders';

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const text = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).note : null;
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Note text is required.' }, { status: 400 });
    }

    const { data: orderRaw } = await supabase.from('orders').select('id, admin_notes').eq('id', params.id).maybeSingle();
    if (!orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const newEntry: AdminOrderNote = {
      text: text.trim(),
      author: (adminProfile.full_name as string | undefined) ?? user.email ?? 'Admin',
      at: new Date().toISOString(),
    };
    const notes = [newEntry, ...parseAdminNotes(orderRaw.admin_notes as string | null)];

    const { error: updateError } = await supabase
      .from('orders')
      .update({ admin_notes: JSON.stringify(notes), updated_at: new Date().toISOString() })
      .eq('id', params.id);

    if (updateError) {
      console.error('[Order Note Update Error]', updateError);
      return NextResponse.json({ error: 'Could not save the note. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'add_order_note',
      resourceType: 'order',
      resourceId: params.id,
      afterValue: { note: newEntry.text },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('[Order Note Route Error]', error);
    return NextResponse.json({ error: 'Could not save the note. Please try again.' }, { status: 500 });
  }
}
