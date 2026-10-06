import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { getAdminCaller } from '@/lib/email-intake/server';

/**
 * A human correction to an AI-read line item. The line item is updated in place AND the old -> new change is
 * written to the append-only `takeoff_corrections` table (a DB trigger forbids UPDATE/DELETE on it). That table is
 * the takeoff accuracy dataset: how often the AI is right, per profile type.
 */
const NUMERIC_FIELDS = ['width', 'height', 'legA', 'legB', 'lengthFt', 'quantity'] as const;
const TEXT_FIELDS = ['profileType', 'material', 'gauge', 'finish', 'unit'] as const;
const FLAG_FOR_FIELD: Record<string, string[]> = {
  lengthFt: ['Length not read - enter it', 'Quantity equals length - confirm piece count vs. linear feet', 'Length over 10 ft per piece - check whether this is a run total'],
  quantity: ['Piece count not read - confirm it', 'Quantity equals length - confirm piece count vs. linear feet'],
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const caller = await getAdminCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { lineItemId?: string; field?: string; value?: unknown; reason?: string } | null;
  const field = body?.field;
  if (!body?.lineItemId || !field) return NextResponse.json({ error: 'lineItemId and field are required' }, { status: 400 });

  let value: string | number | null;
  if ((NUMERIC_FIELDS as readonly string[]).includes(field)) {
    if (body.value === null || body.value === '' || body.value === undefined) value = null;
    else if (typeof body.value === 'number' || typeof body.value === 'string') {
      const n = Number(body.value);
      if (!Number.isFinite(n) || n < 0 || n > 100000) return NextResponse.json({ error: `${field} must be a positive number` }, { status: 400 });
      value = n;
    } else return NextResponse.json({ error: `${field} must be a number` }, { status: 400 });
  } else if ((TEXT_FIELDS as readonly string[]).includes(field)) {
    if (body.value === null || body.value === undefined || body.value === '') {
      if (field === 'profileType') return NextResponse.json({ error: 'profileType cannot be blank' }, { status: 400 });
      value = null;
    } else if (typeof body.value === 'string' && body.value.length <= 120) value = body.value.trim();
    else return NextResponse.json({ error: `${field} must be short text` }, { status: 400 });
  } else {
    return NextResponse.json({ error: 'That field cannot be corrected here' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: qr } = await admin.from('quote_requests').select('id, line_items').eq('id', params.id).maybeSingle();
  if (!qr) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const items = (qr.line_items as Record<string, unknown>[]) ?? [];
  const idx = items.findIndex((i) => i.id === body.lineItemId);
  if (idx < 0) return NextResponse.json({ error: 'Line item not found' }, { status: 404 });

  const oldValue = (items[idx][field] as unknown) ?? null;
  if (oldValue === value) return NextResponse.json({ item: items[idx], unchanged: true });

  const flags = Array.isArray(items[idx].flags) ? (items[idx].flags as string[]).filter((f) => !(FLAG_FOR_FIELD[field] ?? []).includes(f)) : [];
  const updated = { ...items[idx], [field]: value, flags, edited: true };
  const next = items.map((i, n) => (n === idx ? updated : i));

  // Write the correction FIRST (append-only record), then the change. If the second write fails the record
  // still shows the attempted change, which is the safe direction for an audit trail.
  const { error: cErr } = await admin.from('takeoff_corrections').insert({
    quote_request_id: params.id,
    line_item_id: body.lineItemId,
    profile_type: String(items[idx].profileType ?? ''),
    field,
    old_value: oldValue,
    new_value: value,
    user_id: caller.id,
    reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
  });
  if (cErr) return NextResponse.json({ error: 'Could not record the correction' }, { status: 500 });
  const { error: uErr } = await admin.from('quote_requests').update({ line_items: next }).eq('id', params.id);
  if (uErr) return NextResponse.json({ error: 'Could not save the change' }, { status: 500 });

  await logAdminAction({ adminId: caller.id, action: 'takeoff_correction', resourceType: 'quote_request', resourceId: params.id, beforeValue: { [field]: oldValue }, afterValue: { [field]: value } });
  return NextResponse.json({ item: updated });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const caller = await getAdminCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from('takeoff_corrections').select('*').eq('quote_request_id', params.id).order('created_at', { ascending: false }).limit(200);
  return NextResponse.json({ corrections: data ?? [] });
}
