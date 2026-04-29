-- 20260429210000_remove_use_rpc_client_creation_flag.sql
--
-- P2: remove a flag `use_rpc_client_creation` apos remocao do caminho legacy
-- de criacao de cliente. Path RPC `create_client_with_automations` e o unico
-- usado pelo frontend agora.

BEGIN;

DELETE FROM public.feature_flags WHERE key = 'use_rpc_client_creation';

COMMIT;
