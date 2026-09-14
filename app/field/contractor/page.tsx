import type { Metadata } from 'next';
import ContractorCameraQuoteForm from '@/components/field/ContractorCameraQuoteForm';

// Route-scoped PWA install (afs-fl-010) -- overrides the root layout's
// manifest/icons for this segment only, per Next.js metadata resolution
// (a segment's `manifest`/`icons` replace rather than merge with the
// parent's). Does not touch auth: still no role gate (afs-fl-007).
export const metadata: Metadata = {
  manifest: '/field-contractor-manifest.json',
  icons: {
    icon: '/field-contractor-icon-192.png',
    apple: '/field-contractor-apple-touch-icon.png',
  },
};

/**
 * Camera-to-quote flow (afs-fl-002). Strictly photo + optional job-identity
 * fields -- no FlashDraft, no drawing tool. See
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
