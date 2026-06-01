-- Invariante de dado: clients.status só aceita a allowlist canônica de lifecycle.
--
-- WHY: o status legado 'campaign_published' criava um limbo — clientes nesse
-- status sumiam do board do gestor de ads (AdsAcompanhamentoSection só renderiza
-- status='active' + campaign_published_at NOT NULL). O incidente do Ágape (cliente
-- preso em campaign_published, invisível) já foi limpo no remoto; este CHECK torna
-- a reintrodução impossível, falhando alto no write em vez de silenciar.
--
-- O modelo canônico moderno está em src/lib/clientStatus.ts: "campanha publicada /
-- em acompanhamento" NÃO é um status, é status='active' + campaign_published_at.
-- Os 4 valores abaixo são o lifecycle inteiro (deriveRestoredStatus + churn + RPC
-- de criação que insere 'new_client'). Distribuição confirmada no remoto antes
-- desta migration: active(64), onboarding(18), churned(14), new_client(9), 0 NULL.
--
-- NULL é permitido explicitamente: a coluna é nullable e triggers de onboarding
-- tratam NULL como equivalente a 'new_client' (status IS NULL OR status='new_client').
-- Nenhum write grava NULL hoje (default 'new_client'), mas o CHECK não deve quebrar
-- esse contrato histórico.
--
-- NOT VALID + VALIDATE em statements separados: ADD ... NOT VALID não faz full table
-- scan nem trava a tabela; VALIDATE só pega SHARE UPDATE EXCLUSIVE (não bloqueia
-- writes concorrentes). Se VALIDATE falhar, há linha fora da allowlist → investigar.

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check
  CHECK (status IS NULL OR status IN ('active', 'onboarding', 'new_client', 'churned'))
  NOT VALID;

ALTER TABLE public.clients
  VALIDATE CONSTRAINT clients_status_check;

COMMENT ON CONSTRAINT clients_status_check ON public.clients IS
  'Allowlist canônica de lifecycle (src/lib/clientStatus.ts). Bloqueia o status legado campaign_published (limbo do Ágape) e qualquer valor fora da lista. NULL permitido (equivalente a new_client nos triggers de onboarding).';
