// Shared localStorage handoff key/shape for "Open in FlashDraft" from
// CommandCenterJobCard.tsx (Phase 3b) -- same pattern as the existing
// canonical-profile handoff (see app/studio/draft/page.tsx's
// loadCanonicalFromHandoff / afs-flashdraft-canonical-points): the sending
// page writes this blob just before navigating, the draft page reads and
// clears it once on mount. Avoids a server round-trip since
// CommandCenterJobCard already has the full job (including bends) as a
// prop -- no new API route needed.
export const ADMIN_JOB_HANDOFF_KEY = 'afs-flashdraft-admin-job-handoff';

export interface AdminJobHandoffBend {
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

export interface AdminJobHandoffPayload {
  jobId: string;
  profileName: string;
  material: string | null;
  gauge: string | null;
  quantity: number;
  bends: AdminJobHandoffBend[];
}
