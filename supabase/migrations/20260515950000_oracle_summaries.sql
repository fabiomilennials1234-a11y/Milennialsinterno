-- ============================================================
-- Oracle Summaries — Tabela para resumos diários gerados por IA
-- Dois modos: 'group' (visão consolidada do grupo) e 'individual' (visão pessoal)
-- ============================================================

-- 1. Tabela principal
CREATE TABLE public.oracle_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_type text NOT NULL CHECK (summary_type IN ('group', 'individual')),
  group_id uuid REFERENCES public.organization_groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reference_date date NOT NULL,
  summary_content text NOT NULL DEFAULT '',
  raw_data jsonb,
  model_used text DEFAULT 'gpt-4o-mini',
  tokens_used integer,
  created_at timestamptz DEFAULT now(),

  -- Garante consistência: group → group_id obrigatório, individual → user_id obrigatório
  CONSTRAINT oracle_summaries_type_scope CHECK (
    (summary_type = 'group' AND group_id IS NOT NULL AND user_id IS NULL) OR
    (summary_type = 'individual' AND user_id IS NOT NULL AND group_id IS NULL)
  ),

  -- Idempotência: no máximo 1 resumo por tipo+escopo+dia
  CONSTRAINT oracle_summaries_unique UNIQUE (summary_type, group_id, user_id, reference_date)
);

-- 2. Indexes para queries frequentes (frontend busca o resumo mais recente)
CREATE INDEX idx_oracle_summaries_group_date
  ON public.oracle_summaries (group_id, reference_date DESC)
  WHERE summary_type = 'group';

CREATE INDEX idx_oracle_summaries_user_date
  ON public.oracle_summaries (user_id, reference_date DESC)
  WHERE summary_type = 'individual';

-- 3. RLS
ALTER TABLE public.oracle_summaries ENABLE ROW LEVEL SECURITY;

-- Resumos de grupo: membros do grupo + executivos
CREATE POLICY "oracle_group_select" ON public.oracle_summaries
  FOR SELECT USING (
    summary_type = 'group' AND (
      is_ceo(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
          AND p.group_id = oracle_summaries.group_id
      )
    )
  );

-- Resumos individuais: o próprio usuário + executivos
CREATE POLICY "oracle_individual_select" ON public.oracle_summaries
  FOR SELECT USING (
    summary_type = 'individual' AND (
      is_ceo(auth.uid()) OR
      oracle_summaries.user_id = auth.uid()
    )
  );

-- Sem INSERT/UPDATE/DELETE via client — apenas service_role
