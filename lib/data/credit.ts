import type { SupabaseClient } from '@supabase/supabase-js';

export interface CreditApplicationAddress {
  street: string;
  cityStateZip: string;
}

export interface CreditApplicationBankAccounts {
  savingsAccountNumber: string | null;
  checkingAccountNumber: string | null;
  otherAccountNumber: string | null;
}

export interface CreditApplicationTradeReference {
  businessName: string;
  address: string;
  cityStateZip: string;
  phone: string;
  fax?: string;
  email: string;
  accountType: string;
}

export interface CreditApplicationSignature {
  name: string;
  title: string;
  signatureTyped: string;
}

export interface CreditApplicationData {
  poRequired: boolean;
  legalBusinessName: string;
  dbaName: string | null;
  phone: string;
  fax: string | null;
  email: string;
  registeredAddress: CreditApplicationAddress;
  dateCommenced: string;
  businessType: string;
  taxId: string;
  annualRevenue: string;
  primaryAddress: CreditApplicationAddress;
  timeAtAddress: string;
  businessTelephone: string;
  businessFax: string | null;
  businessEmail: string;
  bankName: string;
  bankAddress: string;
  bankCityStateZip: string;
  bankPhone: string;
  bankAccounts: CreditApplicationBankAccounts;
  tradeReferences: CreditApplicationTradeReference[];
  certificationAccepted: boolean;
  agreementTermsVersion: string;
  signerOne: CreditApplicationSignature;
  signerTwo: CreditApplicationSignature;
  signedAt: string;
}

export interface CreditApplicationRow {
  id: string;
  companyId: string | null;
  companyName: string;
  requestedLimit: number | null;
  requestedTerms: number | null;
  status: string;
  submittedAt: string;
  approvedLimit: number | null;
  approvedTerms: number | null;
  reviewerNotes: string | null;
  applicationData: Partial<CreditApplicationData> | null;
}

interface CreditApplicationSource {
  id: string;
  company_id: string | null;
  requested_limit: number | null;
  requested_terms: number | null;
  status: string;
  submitted_at: string;
  approved_limit: number | null;
  approved_terms: number | null;
  reviewer_notes: string | null;
  application_data: Partial<CreditApplicationData> | null;
  profiles: { full_name: string; company: string | null } | null;
}

export async function getCreditApplications(supabase: SupabaseClient): Promise<CreditApplicationRow[]> {
  const { data } = await supabase
    .from('credit_applications')
    .select(
      'id, company_id, requested_limit, requested_terms, status, submitted_at, approved_limit, approved_terms, reviewer_notes, application_data, profiles(full_name, company)'
    )
    .order('submitted_at', { ascending: false });

  return ((data ?? []) as unknown as CreditApplicationSource[]).map((row) => {
    const legalName = row.application_data?.legalBusinessName;
    const companyName =
      row.profiles?.company || (typeof legalName === 'string' && legalName) || row.profiles?.full_name || 'Unknown';
    return {
      id: row.id,
      companyId: row.company_id,
      companyName,
      requestedLimit: row.requested_limit,
      requestedTerms: row.requested_terms,
      status: row.status,
      submittedAt: row.submitted_at,
      approvedLimit: row.approved_limit,
      approvedTerms: row.approved_terms,
      reviewerNotes: row.reviewer_notes,
      applicationData: row.application_data ?? null,
    };
  });
}
