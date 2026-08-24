import { createClient } from '@/lib/supabase/server';
import { requireFieldRole } from '@/lib/field/auth';
import ContractorCameraQuoteForm from '@/components/field/ContractorCameraQuoteForm';

/**
 * Camera-to-quote flow (afs-fl-002). Strictly photo + optional job-identity
 * fields -- no FlashDraft, no drawing tool, no configurator. See
 * SESSION_STATE.md for the field mapping and photo-storage decision.
 * Allowed roles: 'contractor' (primary) plus 'admin' — shop staff need to
 * be able to open the contractor flow for oversight/testing without a
 * second account, and 'admin' already has read/write access everywhere
 * else in this schema, so this isn't a new privilege.
 */
export default async function FieldContractorPage() {
  const supabase = await createClient();
  await requireFieldRole(supabase, ['contractor', 'admin']);

  return <ContractorCameraQuoteForm />;
}
