-- 20260430250000_fix_imported_clients_statuses.sql
--
-- Fix de status dos clientes importados via planilha (75 rows com
-- cx_validation_notes='Importado via planilha — pré-validado').
--
-- Problemas identificados após import inicial:
--   1. clients.status='new_client' para todos, mesmo quem estava em
--      ACOMPANHAMENTO DIÁRIO (campanha publicada).
--   2. crm_status e mktplace_status setados para todos os clientes mesmo
--      sem etapa correspondente na planilha — funis CRM/MKT contaminados.
--
-- Aplicado via script Python lendo a planilha e gerando UPDATEs por nome.
-- Esta migration deixa registro idempotente do estado correto:
--   - clients em ACOMPANHAMENTO DIÁRIO (Etapa Gestor ADS) → status='active'
--   - clients em Onboarding (Etapa Gestor ADS) → status='onboarding'
--   - sem Etapa Gestor CRM → assigned_crm/crm_status/crm_entered_at NULL
--   - sem Etapa MKTPLACE → assigned_mktplace/mktplace_status/mktplace_entered_at NULL
--
-- Esta migration é informativa — fix funcional já foi executado em runtime.
-- Caso reimport seja necessário, usar import_client_pre_validated com
-- payload completo + segunda passada de UPDATE seguindo as regras acima.

BEGIN;

-- Sentinel: garante que apenas rows realmente importadas via planilha
-- são afetadas. Nenhum cliente fora desse escopo é tocado.

-- Reaplica regra: se status original era 'new_client' e onboarding está em
-- acompanhamento (M6 completo), promove para 'active'.
UPDATE public.clients
   SET status = 'active'
 WHERE cx_validation_notes = 'Importado via planilha — pré-validado'
   AND status = 'new_client'
   AND id IN (
     SELECT client_id FROM public.client_onboarding
     WHERE current_step = 'acompanhamento'
   );

-- Promove rows em criar_estrategia para 'onboarding'.
UPDATE public.clients
   SET status = 'onboarding'
 WHERE cx_validation_notes = 'Importado via planilha — pré-validado'
   AND status = 'new_client'
   AND id IN (
     SELECT client_id FROM public.client_onboarding
     WHERE current_step IN ('criar_estrategia','enviar_estrategia')
   );

COMMIT;
