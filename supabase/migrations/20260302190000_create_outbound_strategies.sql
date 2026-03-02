-- ============================================================
-- Tabela: outbound_strategies
-- Estratégias de outbound para clientes (Prospecção Ativa, Remarketing de Base, Ambos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.outbound_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Configurações gerais
  monthly_budget NUMERIC,
  target_region TEXT,
  target_icp TEXT,
  use_client_base BOOLEAN DEFAULT false,
  client_base_details TEXT,
  tools_used TEXT,

  -- Tipos de estratégia (mutuamente exclusivos)
  prospeccao_ativa_enabled BOOLEAN DEFAULT false,
  remarketing_base_enabled BOOLEAN DEFAULT false,
  ambos_enabled BOOLEAN DEFAULT false,

  -- Prospecção Ativa - sub-estratégias (JSONB)
  pa_linkedin_prospecting JSONB,
  pa_cold_calling JSONB,
  pa_cold_email JSONB,
  pa_whatsapp_outreach JSONB,

  -- Remarketing de Base - sub-estratégias (JSONB)
  rb_email_reactivation JSONB,
  rb_whatsapp_nurturing JSONB,
  rb_upsell_crosssell JSONB,

  -- Notas combinadas (quando ambos_enabled = true)
  ambos_combined_notes TEXT,

  -- Publicação
  public_token UUID DEFAULT gen_random_uuid(),
  is_published BOOLEAN DEFAULT false
);

-- RLS
ALTER TABLE public.outbound_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outbound strategies"
  ON public.outbound_strategies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create outbound strategies"
  ON public.outbound_strategies FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update outbound strategies"
  ON public.outbound_strategies FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete outbound strategies"
  ON public.outbound_strategies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public can view published outbound strategies"
  ON public.outbound_strategies FOR SELECT TO anon USING (is_published = true);

-- Indexes
CREATE INDEX idx_outbound_strategies_client_id ON public.outbound_strategies(client_id);
CREATE INDEX idx_outbound_strategies_public_token ON public.outbound_strategies(public_token);
