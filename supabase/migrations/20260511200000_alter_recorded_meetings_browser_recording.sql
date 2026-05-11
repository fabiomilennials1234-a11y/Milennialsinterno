-- Add columns for browser-based recording feature
-- client_id: optional link to a client
-- file_size: video file size in bytes
-- duration_seconds: recording duration
-- recorded_in_browser: flag for recordings made via the in-app recorder
-- audio_file_url: separate audio track for future transcription
-- transcript / transcript_status: future transcription support

ALTER TABLE recorded_meetings
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS recorded_in_browser boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_file_url text,
  ADD COLUMN IF NOT EXISTS transcript jsonb,
  ADD COLUMN IF NOT EXISTS transcript_status text DEFAULT 'none'
    CHECK (transcript_status IN ('none', 'processing', 'completed', 'failed'));

-- Index on client_id for filtering meetings by client
CREATE INDEX IF NOT EXISTS idx_recorded_meetings_client ON recorded_meetings(client_id)
  WHERE client_id IS NOT NULL;

-- RLS: no changes needed — existing policies allow all authenticated users full CRUD.
-- The new columns inherit the same open policies. This is correct for an internal team tool.
