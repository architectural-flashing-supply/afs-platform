import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BusinessType = 'sole_proprietorship' | 'partnership' | 'corporation' | 'other';
type AnnualRevenue = '<500k' | '500k-2m' | '2m-10m' | '10m+';
type RequestedTerms = 15 | 30 | 60;

interface AddressInput {
  street: string;
  cityStateZip: string;
}

interface BankAccountsInput {
  savingsAccountNumber?: string | null;
  checkingAccountNumber?: string | null;
  otherAccountNumber?: string | null;
}

interface TradeReferenceInput {
  businessName: string;
  address: string;
  cityStateZip: string;
  phone: string;
  fax?: string;
  email: string;
  accountType: string;
}

interface SignatureInput {
  name: string;
  title: string;
  signatureTyped: string;
}

interface CreditApplyBody {
  poRequired?: boolean;
  legalBusinessName?: string;
  dbaName?: string | null;
  phone?: string;
  fax?: string | null;
  email?: string;
  registeredAddress?: AddressInput;
  dateCommenced?: string;
  businessType?: BusinessType;
  taxId?: string;
  annualRevenue?: AnnualRevenue;
  primaryAddress?: AddressInput;
  timeAtAddress?: string;
  businessTelephone?: string;
  businessFax?: string | null;
  businessEmail?: string;
  bankName?: string;
  bankAddress?: string;
  bankCityStateZip?: string;
  bankPhone?: string;
  bankAccounts?: BankAccountsInput;
  tradeReferences?: TradeReferenceInput[];
  requestedCreditLimit?: number;
  requestedTerms?: RequestedTerms;
  certificationAccepted?: boolean;
  agreementTermsVersion?: string;
  signerOne?: SignatureInput;
  signerTwo?: SignatureInput;
}

const BUSINESS_TYPES: BusinessType[] = ['sole_proprietorship', 'partnership', 'corporation', 'other'];
const REVENUE_BANDS: AnnualRevenue[] = ['<500k', '500k-2m', '2m-10m', '10m+'];
const TERMS_OPTIONS: RequestedTerms[] = [15, 30, 60];

function isValidAddress(addr: unknown): addr is AddressInput {
  if (!addr || typeof addr !== 'object') return false;
  const a = addr as Record<string, unknown>;
  return typeof a.street === 'string' && a.street.trim().length > 0 && typeof a.cityStateZip === 'string' && a.cityStateZip.trim().length > 0;
}

function isValidReference(ref: unknown): ref is TradeReferenceInput {
  if (!ref || typeof ref !== 'object') return false;
  const r = ref as Record<string, unknown>;
  return (
    typeof r.businessName === 'string' &&
    r.businessName.trim().length > 0 &&
    typeof r.address === 'string' &&
    r.address.trim().length > 0 &&
    typeof r.cityStateZip === 'string' &&
    r.cityStateZip.trim().length > 0 &&
    typeof r.phone === 'string' &&
    r.phone.trim().length > 0 &&
    typeof r.email === 'string' &&
    r.email.trim().length > 0 &&
    typeof r.accountType === 'string' &&
    r.accountType.trim().length > 0
  );
}

function isValidSignature(sig: unknown): sig is SignatureInput {
  if (!sig || typeof sig !== 'object') return false;
  const s = sig as Record<string, unknown>;
  return (
    typeof s.name === 'string' &&
    s.name.trim().length > 0 &&
    typeof s.title === 'string' &&
    s.title.trim().length > 0 &&
    typeof s.signatureTyped === 'string' &&
    s.signatureTyped.trim().length > 0
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

    if (typeof body.poRequired !== 'boolean') {
      return NextResponse.json({ error: 'Select whether a Purchase Order is required.' }, { status: 400 });
    }
    if (!body.legalBusinessName?.trim()) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
    }
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    if (!isValidAddress(body.registeredAddress)) {
      return NextResponse.json({ error: 'Registered company address is required.' }, { status: 400 });
    }
    if (!body.dateCommenced?.trim()) {
      return NextResponse.json({ error: 'Enter the date business commenced.' }, { status: 400 });
    }
    if (!body.businessType || !BUSINESS_TYPES.includes(body.businessType)) {
      return NextResponse.json({ error: 'Select a valid business type.' }, { status: 400 });
    }
    if (!body.taxId?.trim()) {
      return NextResponse.json({ error: 'EIN / Tax ID is required.' }, { status: 400 });
    }
    if (!body.annualRevenue || !REVENUE_BANDS.includes(body.annualRevenue)) {
      return NextResponse.json({ error: 'Select a valid annual revenue range.' }, { status: 400 });
    }

    if (!isValidAddress(body.primaryAddress)) {
      return NextResponse.json({ error: 'Primary business address is required.' }, { status: 400 });
    }
    if (!body.timeAtAddress?.trim()) {
      return NextResponse.json({ error: 'Enter how long you have been at this address.' }, { status: 400 });
    }
    if (!body.businessTelephone?.trim()) {
      return NextResponse.json({ error: 'Business telephone is required.' }, { status: 400 });
    }
    if (!body.businessEmail?.trim()) {
      return NextResponse.json({ error: 'Business email is required.' }, { status: 400 });
    }
    if (!body.bankName?.trim()) {
      return NextResponse.json({ error: 'Bank name is required.' }, { status: 400 });
    }
    if (!body.bankAddress?.trim() || !body.bankCityStateZip?.trim()) {
      return NextResponse.json({ error: 'Bank address is required.' }, { status: 400 });
    }
    if (!body.bankPhone?.trim()) {
      return NextResponse.json({ error: 'Bank phone is required.' }, { status: 400 });
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

    if (body.certificationAccepted !== true) {
      return NextResponse.json({ error: 'You must agree to the terms to continue.' }, { status: 400 });
    }
    if (!body.agreementTermsVersion?.trim()) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    if (!isValidSignature(body.signerOne) || !isValidSignature(body.signerTwo)) {
      return NextResponse.json({ error: 'Both signature blocks are required.' }, { status: 400 });
    }

    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

    const signedAt = new Date().toISOString();

    const applicationData = {
      poRequired: body.poRequired,
      legalBusinessName: body.legalBusinessName.trim(),
      dbaName: body.dbaName?.trim() || null,
      phone: body.phone.trim(),
      fax: body.fax?.trim() || null,
      email: body.email.trim(),
      registeredAddress: body.registeredAddress,
      dateCommenced: body.dateCommenced,
      businessType: body.businessType,
      taxId: body.taxId.trim(),
      annualRevenue: body.annualRevenue,
      primaryAddress: body.primaryAddress,
      timeAtAddress: body.timeAtAddress.trim(),
      businessTelephone: body.businessTelephone.trim(),
      businessFax: body.businessFax?.trim() || null,
      businessEmail: body.businessEmail.trim(),
      bankName: body.bankName.trim(),
      bankAddress: body.bankAddress.trim(),
      bankCityStateZip: body.bankCityStateZip.trim(),
      bankPhone: body.bankPhone.trim(),
      bankAccounts: {
        savingsAccountNumber: body.bankAccounts?.savingsAccountNumber?.trim() || null,
        checkingAccountNumber: body.bankAccounts?.checkingAccountNumber?.trim() || null,
        otherAccountNumber: body.bankAccounts?.otherAccountNumber?.trim() || null,
      },
      tradeReferences,
      certificationAccepted: true,
      agreementTermsVersion: body.agreementTermsVersion,
      signerOne: body.signerOne,
      signerTwo: body.signerTwo,
      signedAt,
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
