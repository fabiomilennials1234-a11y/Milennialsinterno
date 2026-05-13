-- Recording sessions table for resilient chunk-based recording.
-- Tracks in-progress recordings so crashed/closed browsers can recover.

CREATE TABLE recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership & context
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  folder_id UUID NOT NULL REFERENCES meeting_folders(id),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- State machine: recording → stopped → assembling → done | failed | abandoned
  status TEXT NOT NULL DEFAULT 'recording'
    CHECK (status IN ('recording', 'stopped', 'assembling', 'done', 'failed', 'abandoned')),

  -- Progress tracking
  chunk_count INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  duration_seconds INTEGER,

  -- Storage references
  storage_prefix TEXT NOT NULL,
  final_video_path TEXT,
  final_audio_path TEXT,

  -- Link to final recorded_meetings row (set after assembly)
  meeting_id UUID REFERENCES recorded_meetings(id),

  -- Error info
  error_message TEXT,

  -- Lifecycle timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  assembled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX idx_recording_sessions_created_by ON recording_sessions(created_by);
CREATE INDEX idx_recording_sessions_status ON recording_sessions(status)
  WHERE status IN ('recording', 'stopped', 'assembling');
CREATE INDEX idx_recording_sessions_folder ON recording_sessions(folder_id);

-- RLS (same open pattern as recorded_meetings — internal team tool)
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view recording_sessions"
  ON recording_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create recording_sessions"
  ON recording_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update recording_sessions"
  ON recording_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete recording_sessions"
  ON recording_sessions FOR DELETE TO authenticated USING (true);

-- updated_at trigger (reuse existing function)
CREATE TRIGGER set_recording_sessions_updated_at
  BEFORE UPDATE ON recording_sessions
  FOR EACH ROW EXECUTE FUNCTION update_recorded_meetings_updated_at();
