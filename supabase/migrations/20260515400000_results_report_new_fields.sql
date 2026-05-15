-- 20260515400000_results_report_new_fields.sql
--
-- Adds 4 new analysis fields to client_results_reports for the expanded
-- "Relatório de Resultados GESTÃO (QUINZENAL)" form.

BEGIN;

ALTER TABLE public.client_results_reports
  ADD COLUMN IF NOT EXISTS projecao_funil_quinzena TEXT,
  ADD COLUMN IF NOT EXISTS objetivos_curto_prazo TEXT,
  ADD COLUMN IF NOT EXISTS agenda_treinamentos TEXT,
  ADD COLUMN IF NOT EXISTS dica_comercial TEXT;

COMMENT ON COLUMN public.client_results_reports.projecao_funil_quinzena IS
  'Projeção do funil para a próxima quinzena';
COMMENT ON COLUMN public.client_results_reports.objetivos_curto_prazo IS
  'Objetivos de curto prazo (metas prioritárias próximos 30 dias)';
COMMENT ON COLUMN public.client_results_reports.agenda_treinamentos IS
  'Agenda de treinamentos comerciais';
COMMENT ON COLUMN public.client_results_reports.dica_comercial IS
  'Dica comercial / operacional do mês';

COMMIT;
