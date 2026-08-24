import ContractorCameraQuoteForm from '@/components/field/ContractorCameraQuoteForm';

/**
 * Camera-to-quote flow (afs-fl-002). Strictly photo + optional job-identity
 * fields -- no FlashDraft, no drawing tool, no configurator. See
 * SESSION_STATE.md for the field mapping and photo-storage decision.
 * No auth/role gate (afs-fl-007) -- SPEC_PHOTO_TO_QUOTE_AI.md specifies this
 * flow for anonymous field contractors/superintendents with no AFS account,
 * the same guest-access pattern as /upload (see app/upload/page.tsx and
 * app/api/quote-requests/route.ts's guestEmail handling). Reachable with no
 * Supabase session and no redirect -- ContractorCameraQuoteForm itself
 * decides whether to submit under the signed-in user or collect a guest
 * email, mirroring /upload's isAuthenticated + showEmailCapture flow.
 */
export default function FieldContractorPage() {
  return <ContractorCameraQuoteForm />;
}
