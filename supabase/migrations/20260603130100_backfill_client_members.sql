-- 20260603130100_backfill_client_members.sql
-- Slice 2 (#78) — backfill dos mecanismos legados de involvement para a fonte
-- única cliente.client_members. ADR 0005, grupos (C)+(C').
--
-- Porta:
--   7 colunas assigned_* de public.clients (uma linha por papel não-nulo)
--   + public.client_secondary_managers (papel 'secondary_manager')
-- Normaliza assigned_mktplace TEXT -> user_id UUID (0 valores inválidos hoje;
-- o NULLIF + regex guarda contra lixo futuro: só converte UUID válido).
--
-- Idempotente: ON CONFLICT DO NOTHING (PK composta).
-- ADITIVO: não toca clients nem a RLS.

INSERT INTO cliente.client_members (client_id, user_id, papel_no_cliente)
SELECT id, assigned_ads_manager, 'ads_manager'
  FROM public.clients WHERE assigned_ads_manager IS NOT NULL
UNION ALL
SELECT id, assigned_comercial, 'comercial'
  FROM public.clients WHERE assigned_comercial IS NOT NULL
UNION ALL
SELECT id, assigned_crm, 'crm'
  FROM public.clients WHERE assigned_crm IS NOT NULL
UNION ALL
SELECT id, assigned_rh, 'rh'
  FROM public.clients WHERE assigned_rh IS NOT NULL
UNION ALL
SELECT id, assigned_outbound_manager, 'outbound_manager'
  FROM public.clients WHERE assigned_outbound_manager IS NOT NULL
UNION ALL
SELECT id, assigned_sucesso_cliente, 'sucesso_cliente'
  FROM public.clients WHERE assigned_sucesso_cliente IS NOT NULL
UNION ALL
-- mktplace: TEXT -> UUID. Só converte se casar o formato UUID (defensivo).
SELECT id,
       NULLIF(assigned_mktplace, '')::uuid,
       'mktplace'
  FROM public.clients
 WHERE assigned_mktplace IS NOT NULL
   AND assigned_mktplace <> ''
   AND assigned_mktplace ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
UNION ALL
SELECT client_id, secondary_manager_id, 'secondary_manager'
  FROM public.client_secondary_managers
 WHERE secondary_manager_id IS NOT NULL
ON CONFLICT (client_id, user_id, papel_no_cliente) DO NOTHING;
