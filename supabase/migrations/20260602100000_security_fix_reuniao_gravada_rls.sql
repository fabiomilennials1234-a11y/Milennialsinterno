-- ============================================================
-- Reunião Gravada v2 — Fase A: fechar RLS (BLOQUEANTE)
--
-- PROBLEMA (confirmado por PoC anon em
-- docs/superpowers/security/2026-04-23-rls-leakage-audit.md §3.3 / §5.4):
--   - recorded_meetings + meeting_folders estão com RLS DESABILITADA
--     (pg_class.relrowsecurity = false) → policies ignoradas, anon lê tudo.
--   - recording_sessions tem RLS on mas INSERT/UPDATE/DELETE com USING(true)
--     → qualquer authenticated cria/edita/deleta sessão de outro user.
--
-- FIX: habilitar RLS nas 3 tabelas e escopar por ownership + is_admin.
--   - recording_sessions / meeting_folders → created_by = auth.uid() OR is_admin
--   - recorded_meetings → ownership própria (created_by) OU via folder + is_admin
--
-- Pattern Wave 1: transação única, DROP+CREATE por policy, TO authenticated.
-- ============================================================

BEGIN;

-- ---------- recording_sessions ----------
ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view recording_sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "Authenticated users can create recording_sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "Authenticated users can update recording_sessions" ON public.recording_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete recording_sessions" ON public.recording_sessions;

CREATE POLICY "recording_sessions_select" ON public.recording_sessions
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "recording_sessions_insert" ON public.recording_sessions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "recording_sessions_update" ON public.recording_sessions
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "recording_sessions_delete" ON public.recording_sessions
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- ---------- meeting_folders ----------
ALTER TABLE public.meeting_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_folders_select" ON public.meeting_folders;
DROP POLICY IF EXISTS "meeting_folders_insert" ON public.meeting_folders;
DROP POLICY IF EXISTS "meeting_folders_update" ON public.meeting_folders;
DROP POLICY IF EXISTS "meeting_folders_delete" ON public.meeting_folders;

CREATE POLICY "meeting_folders_select" ON public.meeting_folders
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "meeting_folders_insert" ON public.meeting_folders
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "meeting_folders_update" ON public.meeting_folders
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "meeting_folders_delete" ON public.meeting_folders
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- ---------- recorded_meetings ----------
-- Ownership: própria autoria (created_by) OU dono da folder OU admin.
-- created_by é nullable em rows legadas → ownership via folder cobre esses casos.
ALTER TABLE public.recorded_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recorded_meetings_select" ON public.recorded_meetings;
DROP POLICY IF EXISTS "recorded_meetings_insert" ON public.recorded_meetings;
DROP POLICY IF EXISTS "recorded_meetings_update" ON public.recorded_meetings;
DROP POLICY IF EXISTS "recorded_meetings_delete" ON public.recorded_meetings;

CREATE POLICY "recorded_meetings_select" ON public.recorded_meetings
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_folders f
      WHERE f.id = recorded_meetings.folder_id
        AND f.created_by = auth.uid()
    )
  );

CREATE POLICY "recorded_meetings_insert" ON public.recorded_meetings
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_folders f
      WHERE f.id = recorded_meetings.folder_id
        AND f.created_by = auth.uid()
    )
  );

CREATE POLICY "recorded_meetings_update" ON public.recorded_meetings
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_folders f
      WHERE f.id = recorded_meetings.folder_id
        AND f.created_by = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_folders f
      WHERE f.id = recorded_meetings.folder_id
        AND f.created_by = auth.uid()
    )
  );

CREATE POLICY "recorded_meetings_delete" ON public.recorded_meetings
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meeting_folders f
      WHERE f.id = recorded_meetings.folder_id
        AND f.created_by = auth.uid()
    )
  );

-- Índices pra suportar as policies (ownership lookups) sem seq scan.
CREATE INDEX IF NOT EXISTS idx_recording_sessions_created_by ON public.recording_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_folders_created_by ON public.meeting_folders (created_by);
CREATE INDEX IF NOT EXISTS idx_recorded_meetings_created_by ON public.recorded_meetings (created_by);
CREATE INDEX IF NOT EXISTS idx_recorded_meetings_folder_id ON public.recorded_meetings (folder_id);

COMMIT;
