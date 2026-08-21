import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * Soft-delete only — sets deleted_at, never removes the row. Every read of
 * shop_profile_library (lib/data/shop-profile-library.ts's
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
