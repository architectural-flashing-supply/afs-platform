import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BusinessType = 'corporation' | 'llc' | 'partnership' | 'sole_proprietor';
type AnnualRevenue = '<500k' | '500k-2m' | '2m-10m' | '10m+';
type RequestedTerms = 15 | 30 | 60;

interface TradeReferenceInput {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
}

interface CreditApplyBody {
  legalBusinessName?: string;
  dbaName?: string | null;
  taxId?: string;
  yearsInBusiness?: number;
  businessType?: BusinessType;
  annualRevenue?: AnnualRevenue;
  tradeReferences?: TradeReferenceInput[];
  requestedCreditLimit?: number;
  requestedTerms?: RequestedTerms;
  authorizedName?: string;
  authorizedTitle?: string;
  signatureTyped?: string;
  certificationAccepted?: boolean;
}

const BUSINESS_TYPES: BusinessType[] = ['corporation', 'llc', 'partnership', 'sole_proprietor'];
const REVENUE_BANDS: AnnualRevenue[] = ['<500k', '500k-2m', '2m-10m', '10m+'];
const TERMS_OPTIONS: RequestedTerms[] = [15, 30, 60];

function isValidReference(ref: unknown): ref is TradeReferenceInput {
  if (!ref || typeof ref !== 'object') return false;
  const r = ref as Record<string, unknown>;
  return (
    typeof r.businessName === 'string' &&
    r.businessName.trim().length > 0 &&
    typeof r.contactName === 'string' &&
    r.contactName.trim().length > 0 &&
    typeof r.phone === 'string' &&
    r.phone.trim().length > 0
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as CreditApplyBody | null;
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    if (!body.legalBusinessName?.trim()) {
      return NextResponse.json({ error: 'Legal business name is required.' }, { status: 400 });
    }
    if (!body.taxId?.trim()) {
      return NextResponse.json({ error: 'EIN / Tax ID is required.' }, { status: 400 });
    }
    if (typeof body.yearsInBusiness !== 'number' || body.yearsInBusiness < 0) {
      return NextResponse.json({ error: 'Enter valid years in business.' }, { status: 400 });
    }
    if (!body.businessType || !BUSINESS_TYPES.includes(body.businessType)) {
      return NextResponse.json({ error: 'Select a valid business type.' }, { status: 400 });
    }
    if (!body.annualRevenue || !REVENUE_BANDS.includes(body.annualRevenue)) {
      return NextResponse.json({ error: 'Select a valid annual revenue range.' }, { status: 400 });
    }

    const tradeReferences = (body.tradeReferences ?? []).filter(isValidReference);
    if (tradeReferences.length < 3) {
      return NextResponse.json({ error: 'At least 3 complete trade references are required.' }, { status: 400 });
    }

    if (typeof body.requestedCreditLimit !== 'number' || body.requestedCreditLimit <= 0) {
      return NextResponse.json({ error: 'Enter a valid requested credit limit.' }, { status: 400 });
    }
    if (!body.requestedTerms || !TERMS_OPTIONS.includes(body.requestedTerms)) {
      return NextResponse.json({ error: 'Select valid requested payment terms.' }, { status: 400 });
    }

    if (!body.authorizedName?.trim() || !body.authorizedTitle?.trim() || !body.signatureTyped?.trim()) {
      return NextResponse.json({ error: 'Authorization name, title, and signature are required.' }, { status: 400 });
    }
    if (body.certificationAccepted !== true) {
      return NextResponse.json({ error: 'You must certify this application is accurate.' }, { status: 400 });
    }

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

    const applicationData = {
      legalBusinessName: body.legalBusinessName.trim(),
      dbaName: body.dbaName?.trim() || null,
      taxId: body.taxId.trim(),
      yearsInBusiness: body.yearsInBusiness,
      businessType: body.businessType,
      annualRevenue: body.annualRevenue,
      tradeReferences,
      authorizedName: body.authorizedName.trim(),
      authorizedTitle: body.authorizedTitle.trim(),
      signatureTyped: body.signatureTyped.trim(),
      signedAt: new Date().toISOString(),
      certificationAccepted: true,
    };

    const { data: application, error: insertError } = await supabase
      .from('credit_applications')
      .insert({
        user_id: user.id,
        company_id: profile?.company_id ?? null,
        status: 'submitted',
        application_data: applicationData,
        requested_limit: body.requestedCreditLimit,
        requested_terms: body.requestedTerms,
      })
      .select('id')
      .single();

    if (insertError || !application) {
      console.error('[Credit Apply] Insert failed', insertError);
      return NextResponse.json({ error: 'Could not submit application. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ id: application.id });
  } catch (error) {
    console.error('[Credit Apply Error]', error);
    return NextResponse.json({ error: 'Could not submit application. Please try again.' }, { status: 500 });
  }
}
