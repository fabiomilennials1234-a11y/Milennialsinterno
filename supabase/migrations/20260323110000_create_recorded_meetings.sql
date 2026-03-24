-- Tabela de pastas/categorias para reuniões gravadas
CREATE TABLE IF NOT EXISTS meeting_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de reuniões gravadas
CREATE TABLE IF NOT EXISTS recorded_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES meeting_folders(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  video_filename TEXT,
  ata TEXT,
  summary TEXT,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  participants TEXT[] DEFAULT '{}',
  is_whole_team BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recorded_meetings_folder ON recorded_meetings(folder_id);
CREATE INDEX IF NOT EXISTS idx_recorded_meetings_date ON recorded_meetings(meeting_date DESC);

-- RLS
ALTER TABLE meeting_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorded_meetings ENABLE ROW LEVEL SECURITY;

-- Policies para meeting_folders
CREATE POLICY "Authenticated users can view meeting_folders"
  ON meeting_folders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create meeting_folders"
  ON meeting_folders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting_folders"
  ON meeting_folders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meeting_folders"
  ON meeting_folders FOR DELETE TO authenticated USING (true);

-- Policies para recorded_meetings
CREATE POLICY "Authenticated users can view recorded_meetings"
  ON recorded_meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create recorded_meetings"
  ON recorded_meetings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update recorded_meetings"
  ON recorded_meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete recorded_meetings"
  ON recorded_meetings FOR DELETE TO authenticated USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_recorded_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_meeting_folders_updated_at
  BEFORE UPDATE ON meeting_folders
  FOR EACH ROW EXECUTE FUNCTION update_recorded_meetings_updated_at();

CREATE TRIGGER set_recorded_meetings_updated_at
  BEFORE UPDATE ON recorded_meetings
  FOR EACH ROW EXECUTE FUNCTION update_recorded_meetings_updated_at();
