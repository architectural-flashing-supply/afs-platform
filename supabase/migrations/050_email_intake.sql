-- 050_email_intake.sql
-- Inbound order email -> AI takeoff -> draft quote request (PHASE4_ADDENDUM_EMAIL_TO_ESTIMATE).
-- ADDITIVE ONLY: new tables, new nullable columns, one private bucket. Safe to apply to production first.
-- Numbered 050 on purpose: 041-049 are reserved for the planned renumber of the colliding 039 migrations.

CREATE TABLE IF NOT EXISTS email_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Where the message came from. 'eml_upload' = admin dropped a .eml; 'webhook' = generic ingest endpoint;
  -- 'graph' = Microsoft Graph (dormant until the Entra app exists).
  provider              text NOT NULL CHECK (provider IN ('eml_upload', 'webhook', 'graph')),
  provider_message_id   text,
  internet_message_id   text,
  conversation_id       text,
  in_reply_to           text,
  -- Idempotency key: the Message-ID header when present, otherwise a sha256 of from+date+subject+body.
  -- UNIQUE, so the same email delivered twice can never be processed twice.
  dedupe_key            text NOT NULL UNIQUE,
  from_address          text,
  from_name             text,
  to_addresses          jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses          jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject               text,
  sent_at               timestamptz,
  html_body             text,
  text_body             text,
  intent                text CHECK (intent IS NULL OR intent IN ('order_or_rfq', 'approval', 'question', 'other')),
  intent_confidence     numeric,
  intent_reason         text,
  status                text NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received', 'ignored', 'processing', 'drafted', 'needs_manual_takeoff', 'attached_to_thread', 'failed')),
  quote_request_id      uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  error                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_messages_conversation_idx ON email_messages (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_messages_status_idx ON email_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_quote_request_idx ON email_messages (quote_request_id) WHERE quote_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_attachments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id  uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename          text NOT NULL,
  content_type      text,
  size_bytes        bigint NOT NULL DEFAULT 0,
  storage_path      text NOT NULL,
  sha256            text,
  is_inline         boolean NOT NULL DEFAULT false,
  page_count        integer,
  -- Takeoff outcome for this attachment. NULL status = not a takeoff candidate (e.g. a signature logo).
  takeoff_status    text CHECK (takeoff_status IS NULL OR takeoff_status IN ('complete', 'partial', 'failed', 'skipped')),
  takeoff_result    jsonb,
  takeoff_error     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_attachments_message_idx ON email_attachments (email_message_id);

ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS source_email_id uuid REFERENCES email_messages(id) ON DELETE SET NULL;
-- draft_from_email = AI drafted it, a human must review and send. needs_manual_takeoff = AI produced nothing usable.
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS intake_status text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_intake_status_check') THEN
    ALTER TABLE quote_requests ADD CONSTRAINT quote_requests_intake_status_check
      CHECK (intake_status IS NULL OR intake_status IN ('draft_from_email', 'needs_manual_takeoff'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS quote_requests_source_email_idx ON quote_requests (source_email_id) WHERE source_email_id IS NOT NULL;

ALTER TABLE takeoff_uploads ADD COLUMN IF NOT EXISTS email_attachment_id uuid REFERENCES email_attachments(id) ON DELETE SET NULL;

-- Append-only record of every human correction to an AI-read line item. This is the takeoff accuracy dataset.
CREATE TABLE IF NOT EXISTS takeoff_corrections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id  uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  line_item_id      text NOT NULL,
  profile_type      text,
  field             text NOT NULL,
  old_value         jsonb,
  new_value         jsonb,
  user_id           uuid,
  reason            text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS takeoff_corrections_qr_idx ON takeoff_corrections (quote_request_id, created_at);

CREATE OR REPLACE FUNCTION takeoff_corrections_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'takeoff_corrections is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS takeoff_corrections_no_update ON takeoff_corrections;
CREATE TRIGGER takeoff_corrections_no_update BEFORE UPDATE OR DELETE ON takeoff_corrections
  FOR EACH ROW EXECUTE FUNCTION takeoff_corrections_append_only();

-- RLS: admin read only. All writes go through the service-role client in server routes.
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeoff_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_messages_admin_read ON email_messages;
CREATE POLICY email_messages_admin_read ON email_messages FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS email_attachments_admin_read ON email_attachments;
CREATE POLICY email_attachments_admin_read ON email_attachments FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS takeoff_corrections_admin_read ON takeoff_corrections;
CREATE POLICY takeoff_corrections_admin_read ON takeoff_corrections FOR SELECT USING (is_admin());

-- Private bucket for attachments and the raw .eml. No public policy: served only via short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false)
ON CONFLICT (id) DO NOTHING;
