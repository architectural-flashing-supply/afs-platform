import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { computeExtendedPrice, round2 } from '@/lib/admin/pricing';

/**
 * "+ Add Line" within a section (BID_DOCUMENT_SCOPE.md §7.2). Server always
 * computes extended_price and recomputes bid_documents.subtotal as the sum
 * across every line item on the bid in the same request — same
 * "server computes the number that matters" discipline send/route.ts
 * already applies to quotes.subtotal/total, never client-trusted.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const { data: section } = await supabase
      .from('bid_document_sections')
      .select('id, bid_id')
      .eq('id', params.sectionId)
      .maybeSingle();
    if (!section || section.bid_id !== params.id) {
      return NextResponse.json({ error: 'Section not found on this bid.' }, { status: 404 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;

    const quantity = typeof body.quantity === 'number' ? body.quantity : NaN;
    const specText = typeof body.specText === 'string' ? body.specText.trim() : '';
    const unit = typeof body.unit === 'string' && body.unit.trim() ? body.unit.trim() : 'LF';
    const unitPrice = typeof body.unitPrice === 'number' ? body.unitPrice : NaN;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0.' }, { status: 400 });
    }
    if (!specText) {
      return NextResponse.json({ error: 'Spec text cannot be empty.' }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: 'Unit price must be a non-negative number.' }, { status: 400 });
    }

    const extendedPrice = computeExtendedPrice(quantity, unitPrice);

    const { count } = await supabase
      .from('bid_document_line_items')
      .select('id', { count: 'exact', head: true })
      .eq('section_id', params.sectionId);

    const { data: lineItem, error } = await supabase
      .from('bid_document_line_items')
      .insert({
        section_id: params.sectionId,
        quantity,
        spec_text: specText,
        unit,
        unit_price: unitPrice,
        extended_price: extendedPrice,
        sort_order: count ?? 0,
      })
      .select('id, section_id, quantity, spec_text, unit, unit_price, extended_price, sort_order')
      .single();

    if (error || !lineItem) {
      console.error('[Bid Line Item Create Error]', error);
      return NextResponse.json({ error: 'Could not add this line item. Please try again.' }, { status: 500 });
    }

    const { data: allSections } = await supabase.from('bid_document_sections').select('id').eq('bid_id', params.id);
    const sectionIds = ((allSections ?? []) as { id: string }[]).map((s) => s.id);
    const { data: allLineItems } =
      sectionIds.length > 0
        ? await supabase.from('bid_document_line_items').select('extended_price').in('section_id', sectionIds)
        : { data: [] };
    const subtotal = round2(
      ((allLineItems ?? []) as { extended_price: number }[]).reduce((sum, i) => sum + i.extended_price, 0)
    );

    await supabase
      .from('bid_documents')
      .update({ subtotal, last_activity_at: new Date().toISOString() })
      .eq('id', params.id);

    return NextResponse.json({
      lineItem: {
        id: lineItem.id,
        sectionId: lineItem.section_id,
        quantity: lineItem.quantity,
        specText: lineItem.spec_text,
        unit: lineItem.unit,
        unitPrice: lineItem.unit_price,
        extendedPrice: lineItem.extended_price,
        sortOrder: lineItem.sort_order,
      },
      subtotal,
    });
  } catch (error) {
    console.error('[Bid Line Item Create Error]', error);
    return NextResponse.json({ error: 'Could not add this line item. Please try again.' }, { status: 500 });
  }
}
