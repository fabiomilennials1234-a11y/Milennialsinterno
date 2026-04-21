-- 20260421100000_enable_rpc_client_creation_flag.sql
--
-- Rollout: ativa RPC transacional create_client_with_automations como
-- caminho default pra todos users. Fundador autorizou 2026-04-21 apos
-- pgTAP 28 asserts green e smoke test pelo CTO confirmar Wave 0 hotfix.
--
-- Reversivel: UPDATE public.feature_flags SET enabled = false WHERE key = 'use_rpc_client_creation';
-- Cache React Query 5min -> efeito propaga em <5min apos flip.

BEGIN;

UPDATE public.feature_flags
SET enabled = true,
    rollout_percentage = 100,
    updated_at = now()
WHERE key = 'use_rpc_client_creation';

-- Sanity: garante que flag existe (seed do 20260420210000 deveria ter inserido)
INSERT INTO public.feature_flags (key, enabled, rollout_percentage, description)
VALUES ('use_rpc_client_creation', true, 100, 'RPC transacional para criacao de cliente (create_client_with_automations). Ativada 2026-04-21.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
