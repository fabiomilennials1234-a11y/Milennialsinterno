-- =====================================================================
-- SECURITY WAVE 1 — #5 Kanban children (card_attachments/comments/activities)
-- =====================================================================
-- Data: 2026-04-23
-- Auditoria: docs/superpowers/security/2026-04-23-rls-leakage-audit.md §3.2
--
-- Tabelas:
--   - card_activities   — SELECT USING(true). INSERT já gated (user_id=auth.uid)
--   - card_attachments  — SELECT USING(true). INSERT/DELETE já gated por role
--   - card_comments     — SELECT USING(true). INSERT/DELETE já gated
--
-- Nota: `kanban_card_briefings` NÃO EXISTE no schema (verificado via pg_tables).
-- O relatório mencionou como item do wave, mas a tabela é nome fantasma.
-- Briefings por departamento (video_briefings, dev_briefings etc.) são outras
-- tabelas — ficam pra wave 2.
--
-- Fix SELECT: herda acesso do card pai via can_view_card(auth.uid(), card_id).
-- Helper já existe (SECURITY DEFINER, cobre admin bypass e board scope).
--
-- INSERT/DELETE/UPDATE mantidos (policies atuais já escopadas por role).
--
-- Rollback: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================

BEGIN;

-- ============================================================
-- card_activities
-- ============================================================
ALTER TABLE public.card_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activities" ON public.card_activities;

DROP POLICY IF EXISTS "card_activities_select" ON public.card_activities;
CREATE POLICY "card_activities_select"
  ON public.card_activities FOR SELECT TO authenticated
  USING (public.can_view_card(auth.uid(), card_id));

-- ============================================================
-- card_attachments
-- ============================================================
ALTER TABLE public.card_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_attachments_select" ON public.card_attachments;
CREATE POLICY "card_attachments_select"
  ON public.card_attachments FOR SELECT TO authenticated
  USING (public.can_view_card(auth.uid(), card_id));

-- ============================================================
-- card_comments
-- ============================================================
ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comments" ON public.card_comments;

DROP POLICY IF EXISTS "card_comments_select" ON public.card_comments;
CREATE POLICY "card_comments_select"
  ON public.card_comments FOR SELECT TO authenticated
  USING (public.can_view_card(auth.uid(), card_id));

DO $$ BEGIN RAISE NOTICE 'security_wave1 #5 kanban children (3 tabelas) fechado via can_view_card'; END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================
