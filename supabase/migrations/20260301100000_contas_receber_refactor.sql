-- ============================================================
-- Migration: Refatorar Contas a Receber
-- - Adicionar payment_due_day na tabela clients
-- - Reestruturar financeiro_contas_receber para per-product
-- - Criar tabela contas_receber_value_adjustments
-- ============================================================

-- 1A. Adicionar payment_due_day na tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS payment_due_day INTEGER DEFAULT NULL;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_payment_due_day_check
  CHECK (payment_due_day IS NULL OR (payment_due_day >= 1 AND payment_due_day <= 31));

-- 1B. Reestruturar financeiro_contas_receber

-- Adicionar novas colunas
ALTER TABLE public.financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inadimplencia_count INTEGER NOT NULL DEFAULT 0;

-- Backfill produto_slug para rows que tem NULL
UPDATE public.financeiro_contas_receber
SET produto_slug = 'consolidated'
WHERE produto_slug IS NULL;

-- Tornar produto_slug NOT NULL
ALTER TABLE public.financeiro_contas_receber
  ALTER COLUMN produto_slug SET NOT NULL,
  ALTER COLUMN produto_slug SET DEFAULT 'consolidated';

-- Dropar UNIQUE constraint antiga (client_id, mes_referencia)
ALTER TABLE public.financeiro_contas_receber
  DROP CONSTRAINT IF EXISTS financeiro_contas_receber_client_id_mes_referencia_key;

-- Adicionar nova UNIQUE constraint (client_id, produto_slug, mes_referencia)
ALTER TABLE public.financeiro_contas_receber
  ADD CONSTRAINT financeiro_contas_receber_client_product_month_key
  UNIQUE (client_id, produto_slug, mes_referencia);

-- Atualizar CHECK constraint de status para incluir 'pago'
ALTER TABLE public.financeiro_contas_receber
  DROP CONSTRAINT IF EXISTS financeiro_contas_receber_status_check;

ALTER TABLE public.financeiro_contas_receber
  ADD CONSTRAINT financeiro_contas_receber_status_check
  CHECK (status IN ('em_dia', 'pago', 'pendente', 'inadimplente'));

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_fcr_client_month
  ON public.financeiro_contas_receber(client_id, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_fcr_status
  ON public.financeiro_contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_fcr_mes_referencia
  ON public.financeiro_contas_receber(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_fcr_produto_slug
  ON public.financeiro_contas_receber(produto_slug);

-- 1C. Criar tabela contas_receber_value_adjustments
CREATE TABLE IF NOT EXISTS public.contas_receber_value_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contas_receber_id UUID NOT NULL REFERENCES public.financeiro_contas_receber(id) ON DELETE CASCADE,
  original_value NUMERIC NOT NULL,
  new_value NUMERIC NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('single_month', 'all_following')),
  justification TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contas_receber_value_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users"
ON public.contas_receber_value_adjustments FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users"
ON public.contas_receber_value_adjustments FOR INSERT
TO authenticated WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_crva_contas_receber_id
  ON public.contas_receber_value_adjustments(contas_receber_id);
CREATE INDEX IF NOT EXISTS idx_crva_user_id
  ON public.contas_receber_value_adjustments(user_id);
