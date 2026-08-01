import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';

/** "+ Add Work Description" (BID_DOCUMENT_SCOPE.md §7.2) — a new section heading a bid's line items group under. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const { data: bid } = await supabase.from('bid_documents').select('id').eq('id', params.id).maybeSingle();
    if (!bid) {
      return NextResponse.json({ error: 'Bid document not found.' }, { status: 404 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const workDescription = typeof body.workDescription === 'string' ? body.workDescription.trim() : '';
    if (!workDescription) {
      return NextResponse.json({ error: 'Work description cannot be empty.' }, { status: 400 });
    }

    const { count } = await supabase
      .from('bid_document_sections')
      .select('id', { count: 'exact', head: true })
      .eq('bid_id', params.id);

    const { data: section, error } = await supabase
      .from('bid_document_sections')
      .insert({ bid_id: params.id, work_description: workDescription, sort_order: count ?? 0 })
      .select('id, work_description, sort_order')
      .single();

    if (error || !section) {
      console.error('[Bid Section Create Error]', error);
      return NextResponse.json({ error: 'Could not add this section. Please try again.' }, { status: 500 });
    }

    await supabase.from('bid_documents').update({ last_activity_at: new Date().toISOString() }).eq('id', params.id);

    return NextResponse.json({
      section: { id: section.id, workDescription: section.work_description, sortOrder: section.sort_order },
    });
  } catch (error) {
    console.error('[Bid Section Create Error]', error);
    return NextResponse.json({ error: 'Could not add this section. Please try again.' }, { status: 500 });
  }
}
