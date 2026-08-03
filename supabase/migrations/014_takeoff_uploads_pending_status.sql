-- The upload flow now issues a Supabase Storage signed upload URL (see
-- app/api/upload/route.ts) before the browser has actually put the file
-- bytes in storage, so the row must be creatable in a state that doesn't yet
-- claim "uploaded". Add 'pending' to the allowed status set.
ALTER TABLE takeoff_uploads DROP CONSTRAINT IF EXISTS takeoff_uploads_status_check;
ALTER TABLE takeoff_uploads ADD CONSTRAINT takeoff_uploads_status_check
  CHECK (status IN ('pending','uploaded','processing','complete','partial','failed'));
ALTER TABLE takeoff_uploads ALTER COLUMN status SET DEFAULT 'pending';
