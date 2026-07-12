import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { getCustomerNotes, type CustomerNote } from '@/lib/data/customers';

const ROLE_OPTIONS = ['admin', 'contractor', 'architect', 'customer'];
const TIER_OPTIONS = ['standard', 'contractor', 'preferred', 'wholesale'];
const NET_TERMS_OPTIONS = [0, 15, 30, 60];

interface AccountSettingsInput {
  role?: string;
  pricingTier?: string;
  netTerms?: number;
  creditLimit?: number | null;
  taxExempt?: boolean;
}

interface ProfileSource {
  id: string;
  role: string;
  pricing_tier: string;
  net_terms: number;
  credit_limit: number | null;
  tax_exempt: boolean;
}

/**
 * Single write endpoint for the customer detail page — handles both the
 * AccountSettings form (accountSettings body) and the append-only AdminNotesLog
 * (note body), matching the one PATCH route documented for this resource.
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

    const { data: adminProfile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;

    const { data: existingRaw } = await supabase
      .from('profiles')
      .select('id, role, pricing_tier, net_terms, credit_limit, tax_exempt')
      .eq('id', params.id)
      .maybeSingle();
    if (!existingRaw) {
      return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
    }
    const existing = existingRaw as ProfileSource;

    let updatedProfile: Record<string, unknown> | undefined;

    if (body.accountSettings && typeof body.accountSettings === 'object') {
      const settings = body.accountSettings as AccountSettingsInput;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (settings.role !== undefined) {
        if (!ROLE_OPTIONS.includes(settings.role)) {
          return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
        }
        update.role = settings.role;
      }
      if (settings.pricingTier !== undefined) {
        if (!TIER_OPTIONS.includes(settings.pricingTier)) {
          return NextResponse.json({ error: 'Invalid pricing tier.' }, { status: 400 });
        }
        update.pricing_tier = settings.pricingTier;
      }
      if (settings.netTerms !== undefined) {
        if (!NET_TERMS_OPTIONS.includes(settings.netTerms)) {
          return NextResponse.json({ error: 'Invalid net terms.' }, { status: 400 });
        }
        update.net_terms = settings.netTerms;
      }
      if (settings.creditLimit !== undefined) {
        if (settings.creditLimit !== null && (typeof settings.creditLimit !== 'number' || settings.creditLimit < 0)) {
          return NextResponse.json({ error: 'Invalid credit limit.' }, { status: 400 });
        }
        update.credit_limit = settings.creditLimit;
      }
      if (settings.taxExempt !== undefined) {
        update.tax_exempt = Boolean(settings.taxExempt);
      }

      const { error: updateError } = await supabase.from('profiles').update(update).eq('id', params.id);
      if (updateError) {
        console.error('[Customer Account Settings Update Error]', updateError);
        return NextResponse.json({ error: 'Could not save account settings. Please try again.' }, { status: 500 });
      }

      await logAdminAction({
        adminId: user.id,
        action: 'update_customer_account_settings',
        resourceType: 'profile',
        resourceId: params.id,
        beforeValue: {
          role: existing.role,
          pricingTier: existing.pricing_tier,
          netTerms: existing.net_terms,
          creditLimit: existing.credit_limit,
          taxExempt: existing.tax_exempt,
        },
        afterValue: update,
      });

      updatedProfile = update;
    }

    let notes: CustomerNote[] | undefined;
    if (typeof body.note === 'string' && body.note.trim()) {
      await logAdminAction({
        adminId: user.id,
        action: 'add_customer_note',
        resourceType: 'profile',
        resourceId: params.id,
        afterValue: { note: body.note.trim() },
      });
      notes = await getCustomerNotes(supabase, params.id);
    }

    return NextResponse.json({ profile: updatedProfile, notes });
  } catch (error) {
    console.error('[Customer Detail Route Error]', error);
    return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
  }
}
