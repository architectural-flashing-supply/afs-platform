// Shared between the client (app/upload/page.tsx), the signed-upload route
// (app/api/upload/route.ts), and the takeoff route (app/api/takeoff/route.ts)
// so the three enforcement points can't drift out of sync.
export const UPLOAD_ACCEPTED_EXTENSIONS = [
  '.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif',
];

export const UPLOAD_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const UPLOAD_MAX_PAGES = 100;
