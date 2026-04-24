-- =====================================================================
-- SECURITY WAVE 1 — #4 RH (8 tabelas) - LGPD
-- =====================================================================
-- Data: 2026-04-23
-- Auditoria: docs/superpowers/security/2026-04-23-rls-leakage-audit.md §2.10
--
-- Escopo:
--   - rh_vagas              — policies USING(true)/auth.uid() NOT NULL roles={public}
--                             PoC anon confirmado (1 row retornada)
--   - rh_vaga_briefings     — idem. PoC anon confirmado
--   - rh_candidatos         — idem. LGPD risk (CPF/email/telefone). FORCE RLS ON.
--   - rh_atividades         — idem
--   - rh_comentarios        — idem
--   - rh_justificativas     — idem
--   - rh_tarefas            — FOR ... authenticated com USING(true)
--   - rh_vaga_plataformas   — idem
--
-- Fix:
--   Policy única por cmd: is_admin(uid) OR has_role(uid, 'rh').
--   Todas a TO authenticated (anon explicitly excluded).
--
-- FORCE RLS:
--   rh_candidatos recebe FORCE ROW LEVEL SECURITY — dados pessoais.
--   Mesmo postgres owner / service_role definido? Service_role bypassa RLS
--   por design (bypassrls). FORCE RLS só cobre owner via ALTER OWNER casos —
--   mantemos por defesa em profundidade + sinal explícito "tabela sensível".
--
-- Rollback: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- =====================================================================

BEGIN;

-- ============================================================
-- rh_vagas
-- ============================================================
ALTER TABLE public.rh_vagas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can delete rh_vagas" ON public.rh_vagas;
DROP POLICY IF EXISTS "Authenticated users can insert rh_vagas" ON public.rh_vagas;
DROP POLICY IF EXISTS "Authenticated users can update rh_vagas" ON public.rh_vagas;
DROP POLICY IF EXISTS "Users can view rh_vagas" ON public.rh_vagas;

DROP POLICY IF EXISTS "rh_vagas_select" ON public.rh_vagas;
CREATE POLICY "rh_vagas_select"
  ON public.rh_vagas FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vagas_insert" ON public.rh_vagas;
CREATE POLICY "rh_vagas_insert"
  ON public.rh_vagas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vagas_update" ON public.rh_vagas;
CREATE POLICY "rh_vagas_update"
  ON public.rh_vagas FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vagas_delete" ON public.rh_vagas;
CREATE POLICY "rh_vagas_delete"
  ON public.rh_vagas FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

-- ============================================================
-- rh_vaga_briefings
-- ============================================================
ALTER TABLE public.rh_vaga_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can delete rh_vaga_briefings" ON public.rh_vaga_briefings;
DROP POLICY IF EXISTS "Authenticated users can insert rh_vaga_briefings" ON public.rh_vaga_briefings;
DROP POLICY IF EXISTS "Authenticated users can update rh_vaga_briefings" ON public.rh_vaga_briefings;
DROP POLICY IF EXISTS "Users can view rh_vaga_briefings" ON public.rh_vaga_briefings;

DROP POLICY IF EXISTS "rh_vaga_briefings_select" ON public.rh_vaga_briefings;
CREATE POLICY "rh_vaga_briefings_select"
  ON public.rh_vaga_briefings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vaga_briefings_insert" ON public.rh_vaga_briefings;
CREATE POLICY "rh_vaga_briefings_insert"
  ON public.rh_vaga_briefings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vaga_briefings_update" ON public.rh_vaga_briefings;
CREATE POLICY "rh_vaga_briefings_update"
  ON public.rh_vaga_briefings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vaga_briefings_delete" ON public.rh_vaga_briefings;
CREATE POLICY "rh_vaga_briefings_delete"
  ON public.rh_vaga_briefings FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

-- ============================================================
-- rh_candidatos — dados pessoais (LGPD). FORCE RLS.
-- ============================================================
ALTER TABLE public.rh_candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_candidatos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can delete rh_candidatos" ON public.rh_candidatos;
DROP POLICY IF EXISTS "Authenticated users can insert rh_candidatos" ON public.rh_candidatos;
DROP POLICY IF EXISTS "Authenticated users can update rh_candidatos" ON public.rh_candidatos;
DROP POLICY IF EXISTS "Users can view rh_candidatos" ON public.rh_candidatos;

DROP POLICY IF EXISTS "rh_candidatos_select" ON public.rh_candidatos;
CREATE POLICY "rh_candidatos_select"
  ON public.rh_candidatos FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_candidatos_insert" ON public.rh_candidatos;
CREATE POLICY "rh_candidatos_insert"
  ON public.rh_candidatos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_candidatos_update" ON public.rh_candidatos;
CREATE POLICY "rh_candidatos_update"
  ON public.rh_candidatos FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_candidatos_delete" ON public.rh_candidatos;
CREATE POLICY "rh_candidatos_delete"
  ON public.rh_candidatos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

-- ============================================================
-- rh_atividades
-- ============================================================
ALTER TABLE public.rh_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert rh_atividades" ON public.rh_atividades;
DROP POLICY IF EXISTS "Users can view rh_atividades" ON public.rh_atividades;

DROP POLICY IF EXISTS "rh_atividades_select" ON public.rh_atividades;
CREATE POLICY "rh_atividades_select"
  ON public.rh_atividades FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

-- INSERT: autor é o próprio user; admin/rh podem inserir em qualquer vaga.
DROP POLICY IF EXISTS "rh_atividades_insert" ON public.rh_atividades;
CREATE POLICY "rh_atividades_insert"
  ON public.rh_atividades FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
    AND user_id = auth.uid()
  );

-- ============================================================
-- rh_comentarios
-- ============================================================
ALTER TABLE public.rh_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert rh_comentarios" ON public.rh_comentarios;
DROP POLICY IF EXISTS "Users can view rh_comentarios" ON public.rh_comentarios;

DROP POLICY IF EXISTS "rh_comentarios_select" ON public.rh_comentarios;
CREATE POLICY "rh_comentarios_select"
  ON public.rh_comentarios FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_comentarios_insert" ON public.rh_comentarios;
CREATE POLICY "rh_comentarios_insert"
  ON public.rh_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
    AND user_id = auth.uid()
  );

-- ============================================================
-- rh_justificativas
-- ============================================================
ALTER TABLE public.rh_justificativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert rh_justificativas" ON public.rh_justificativas;
DROP POLICY IF EXISTS "Users can view rh_justificativas" ON public.rh_justificativas;

DROP POLICY IF EXISTS "rh_justificativas_select" ON public.rh_justificativas;
CREATE POLICY "rh_justificativas_select"
  ON public.rh_justificativas FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_justificativas_insert" ON public.rh_justificativas;
CREATE POLICY "rh_justificativas_insert"
  ON public.rh_justificativas FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
    AND user_id = auth.uid()
  );

-- ============================================================
-- rh_tarefas
-- ============================================================
ALTER TABLE public.rh_tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to delete rh_tarefas" ON public.rh_tarefas;
DROP POLICY IF EXISTS "Allow authenticated users to insert rh_tarefas" ON public.rh_tarefas;
DROP POLICY IF EXISTS "Allow authenticated users to update rh_tarefas" ON public.rh_tarefas;
DROP POLICY IF EXISTS "Allow authenticated users to view rh_tarefas" ON public.rh_tarefas;

DROP POLICY IF EXISTS "rh_tarefas_select" ON public.rh_tarefas;
CREATE POLICY "rh_tarefas_select"
  ON public.rh_tarefas FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_tarefas_insert" ON public.rh_tarefas;
CREATE POLICY "rh_tarefas_insert"
  ON public.rh_tarefas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_tarefas_update" ON public.rh_tarefas;
CREATE POLICY "rh_tarefas_update"
  ON public.rh_tarefas FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_tarefas_delete" ON public.rh_tarefas;
CREATE POLICY "rh_tarefas_delete"
  ON public.rh_tarefas FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

-- ============================================================
-- rh_vaga_plataformas
-- ============================================================
ALTER TABLE public.rh_vaga_plataformas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.rh_vaga_plataformas;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.rh_vaga_plataformas;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.rh_vaga_plataformas;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.rh_vaga_plataformas;

DROP POLICY IF EXISTS "rh_vaga_plataformas_select" ON public.rh_vaga_plataformas;
CREATE POLICY "rh_vaga_plataformas_select"
  ON public.rh_vaga_plataformas FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vaga_plataformas_insert" ON public.rh_vaga_plataformas;
CREATE POLICY "rh_vaga_plataformas_insert"
  ON public.rh_vaga_plataformas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vaga_plataformas_update" ON public.rh_vaga_plataformas;
CREATE POLICY "rh_vaga_plataformas_update"
  ON public.rh_vaga_plataformas FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DROP POLICY IF EXISTS "rh_vaga_plataformas_delete" ON public.rh_vaga_plataformas;
CREATE POLICY "rh_vaga_plataformas_delete"
  ON public.rh_vaga_plataformas FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::public.user_role));

DO $$ BEGIN RAISE NOTICE 'security_wave1 #4 RH (8 tabelas) fechado; rh_candidatos FORCE RLS'; END $$;

COMMIT;

-- =====================================================================
-- ROLLBACK: ver docs/superpowers/qa/2026-04-23-rls-backup-pre-security-wave1.sql
-- Adicional: ALTER TABLE public.rh_candidatos NO FORCE ROW LEVEL SECURITY;
-- =====================================================================
