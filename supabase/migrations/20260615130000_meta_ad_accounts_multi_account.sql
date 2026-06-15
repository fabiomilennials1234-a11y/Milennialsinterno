-- Multi-conta Meta Ads — desacopla três conceitos que hoje colidem em is_active.
--
-- WHY: hoje is_active=true serve a DOIS papéis ao mesmo tempo: "o cron puxa esta
-- conta" e "esta conta aparece no seletor da UI". Registrar ~40 contas de
-- clientes da agência como is_active=true faria o cron (a cada 30min) puxar 40
-- contas do Graph API → rate limit + inchaço do meta_ads_insights. Quebramos os
-- conceitos:
--   is_active    = selecionável no seletor da UI (espiável on-demand)
--   sync_policy  = 'cron' auto-puxada pelo cron; 'on_demand' só quando o CEO abre
--   is_principal = conta default da UI (uma só, garantida por índice único parcial)
--
-- Milennials (act_738610258782410) vira a única principal + a única cron-synced.
-- As ~40 contas de cliente entram depois via modo seed-accounts como on_demand.
-- RLS NÃO muda: meta_ad_accounts permanece CEO-only.

ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS sync_policy text NOT NULL DEFAULT 'on_demand'
    CHECK (sync_policy IN ('cron', 'on_demand'));

ALTER TABLE public.meta_ad_accounts
  ADD COLUMN IF NOT EXISTS is_principal boolean NOT NULL DEFAULT false;

-- Garante NO MÁXIMO uma conta principal. Índice único parcial: só as linhas com
-- is_principal=true ocupam o índice, então múltiplas false coexistem.
CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_ad_accounts_principal
  ON public.meta_ad_accounts (is_principal)
  WHERE is_principal;

-- O cron filtra por sync_policy='cron'; índice parcial mantém o SELECT barato
-- mesmo com 40+ contas on_demand.
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_sync_policy
  ON public.meta_ad_accounts (sync_policy)
  WHERE sync_policy = 'cron';

UPDATE public.meta_ad_accounts
  SET sync_policy = 'cron', is_principal = true
  WHERE account_id = 'act_738610258782410';
