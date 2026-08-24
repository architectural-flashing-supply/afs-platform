// Shared between app/api/field/photo-upload/route.ts (signs the upload) and
// components/field/ContractorCameraQuoteForm.tsx (the camera capture input)
// so the accepted-extension set can't drift out of sync — same pairing
// lib/utils/upload-limits.ts already does for the Blueprint Takeoff flow.
// A phone camera photo, not a scanned drawing — no .pdf/.dwg/.dxf here.
export const FIELD_PHOTO_ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

export const FIELD_PHOTO_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
