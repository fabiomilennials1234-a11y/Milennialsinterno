-- ============================================================
-- Reunião Gravada v2 — Fase D: colunas da Ata (LLM)
--
-- Adiciona a máquina de estados da ata em recorded_meetings e o vínculo
-- idempotente recording_id em client_meeting_notes (upsert por gravação).
--
-- ata (TEXT, já existe) = markdown renderizado pela UI atual.
-- summary (TEXT, já existe) = resumo_executivo.
-- ata_json (NOVO) = estrutura canônica gerada pelo LLM.
-- ============================================================

BEGIN;

-- transcript_status agora inclui 'pending' (finalize enfileira em vez de
-- fire-and-forget; reconciler/transcribe consomem o pending).
ALTER TABLE public.recorded_meetings
  DROP CONSTRAINT IF EXISTS recorded_meetings_transcript_status_check;
ALTER TABLE public.recorded_meetings
  ADD CONSTRAINT recorded_meetings_transcript_status_check
  CHECK (transcript_status IN ('none', 'pending', 'processing', 'completed', 'failed'));

ALTER TABLE public.recorded_meetings
  ADD COLUMN IF NOT EXISTS ata_json jsonb,
  ADD COLUMN IF NOT EXISTS ata_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ata_error text,
  ADD COLUMN IF NOT EXISTS ata_generated_at timestamptz;

-- Enum fechado de estados via CHECK (segue o pattern de transcript_status).
ALTER TABLE public.recorded_meetings
  DROP CONSTRAINT IF EXISTS recorded_meetings_ata_status_check;
ALTER TABLE public.recorded_meetings
  ADD CONSTRAINT recorded_meetings_ata_status_check
  CHECK (ata_status IN ('none', 'pending', 'processing', 'completed', 'failed'));

-- Vínculo idempotente: uma nota de cliente por gravação.
-- ON DELETE SET NULL: apagar a gravação não deve apagar a nota (auditoria).
ALTER TABLE public.client_meeting_notes
  ADD COLUMN IF NOT EXISTS recording_id uuid
  REFERENCES public.recorded_meetings(id) ON DELETE SET NULL;

-- UNIQUE parcial: garante upsert idempotente por recording_id (NULLs livres).
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_meeting_notes_recording_id
  ON public.client_meeting_notes (recording_id)
  WHERE recording_id IS NOT NULL;

-- Índices pra reconciler/UI varrerem por status sem seq scan.
CREATE INDEX IF NOT EXISTS idx_recorded_meetings_ata_status
  ON public.recorded_meetings (ata_status)
  WHERE ata_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_recorded_meetings_transcript_status
  ON public.recorded_meetings (transcript_status)
  WHERE transcript_status IN ('pending', 'processing');

COMMIT;
