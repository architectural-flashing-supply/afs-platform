import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

interface PricingRuleInput {
  costNotes?: string;
  targetMarginPct?: number;
  wasteFactor?: number;
  rushSurchargePct?: number;
}

interface ExistingRuleSource {
  id: string;
  cost_notes: string | null;
  margin_pct: number;
  waste_factor: number;
  rush_surcharge_pct: number;
}

/**
 * Manual pricing mode (SPEC_PRICING_ADMIN.md) — this row is a reference note for
 * estimators, not a live calculation input. Creates the pricing_rules row on first
 * save since products can exist without one yet.
 */
export async function PATCH(request: NextRequest, { params }: { params: { productId: string } }): Promise<NextResponse> {
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
    const body = raw as PricingRuleInput;

    if (body.targetMarginPct !== undefined && (body.targetMarginPct < 0 || body.targetMarginPct > 1)) {
      return NextResponse.json({ error: 'Target margin must be between 0% and 100%.' }, { status: 400 });
    }
    if (body.wasteFactor !== undefined && body.wasteFactor < 1) {
      return NextResponse.json({ error: 'Waste factor must be 1.00 or greater.' }, { status: 400 });
    }
    if (body.rushSurchargePct !== undefined && (body.rushSurchargePct < 0 || body.rushSurchargePct > 1)) {
      return NextResponse.json({ error: 'Rush surcharge must be between 0% and 100%.' }, { status: 400 });
    }

    const { data: product } = await supabase.from('products').select('id').eq('id', params.productId).maybeSingle();
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const { data: existingRaw } = await supabase
      .from('pricing_rules')
      .select('id, cost_notes, margin_pct, waste_factor, rush_surcharge_pct')
      .eq('product_id', params.productId)
      .maybeSingle();
    const existing = existingRaw as ExistingRuleSource | null;

    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.costNotes !== undefined) fields.cost_notes = body.costNotes.slice(0, 200);
    if (body.targetMarginPct !== undefined) fields.margin_pct = body.targetMarginPct;
    if (body.wasteFactor !== undefined) fields.waste_factor = body.wasteFactor;
    if (body.rushSurchargePct !== undefined) fields.rush_surcharge_pct = body.rushSurchargePct;

    let ruleId: string;
    if (existing) {
      const { error: updateError } = await supabase.from('pricing_rules').update(fields).eq('id', existing.id);
      if (updateError) {
        console.error('[Pricing Rule Update Error]', updateError);
        return NextResponse.json({ error: 'Could not save this row. Please try again.' }, { status: 500 });
      }
      ruleId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('pricing_rules')
        .insert({ product_id: params.productId, ...fields })
        .select('id')
        .single();
      if (insertError || !inserted) {
        console.error('[Pricing Rule Insert Error]', insertError);
        return NextResponse.json({ error: 'Could not save this row. Please try again.' }, { status: 500 });
      }
      ruleId = inserted.id as string;
    }

    await logAdminAction({
      adminId: user.id,
      action: 'update_pricing_rule',
      resourceType: 'pricing_rules',
      resourceId: ruleId,
      beforeValue: existing
        ? {
            costNotes: existing.cost_notes,
            marginPct: existing.margin_pct,
            wasteFactor: existing.waste_factor,
            rushSurchargePct: existing.rush_surcharge_pct,
          }
        : null,
      afterValue: fields,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pricing Rule Route Error]', error);
    return NextResponse.json({ error: 'Could not save this row. Please try again.' }, { status: 500 });
  }
}
