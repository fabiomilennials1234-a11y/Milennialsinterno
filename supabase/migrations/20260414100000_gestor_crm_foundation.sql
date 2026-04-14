-- =============================================================
-- Gestor de CRM — Fundação (Commit 1)
--
-- Novas colunas em `clients`:
--   * crm_status           → estado do cliente no kanban do CRM
--                            ('novo' | 'boas_vindas' | 'acompanhamento' | 'finalizado' | null)
--   * crm_entered_at       → timestamp de entrada no fluxo do CRM
--   * torque_crm_products  → sub-produtos contratados dentro do Torque CRM
--                            (subset de: 'v8' | 'automation' | 'copilot')
--
-- Novas tabelas (espelham padrão de MKT Place):
--   * crm_daily_tracking        — acompanhamento diário (seg-sex) por cliente
--   * crm_daily_documentation   — documentação diária estruturada
--   * crm_configuracoes         — uma linha por (cliente, produto) com
--                                 etapa atual + dados do formulário (JSON)
--
-- Comit 1 é puramente aditivo: não mexe em colunas/tabelas existentes,
-- não remove/renomeia nada. `status` da tabela `clients` permanece intocado.
-- =============================================================

-- --------- 1) Clients: novas colunas -----------

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS crm_status text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS crm_entered_at timestamptz;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS torque_crm_products text[] NOT NULL DEFAULT '{}'::text[];

-- Index auxiliar para kanban (apenas clientes com crm_status)
CREATE INDEX IF NOT EXISTS idx_clients_crm_status
  ON public.clients(crm_status)
  WHERE crm_status IS NOT NULL;

-- --------- 2) crm_daily_tracking -----------

CREATE TABLE IF NOT EXISTS public.crm_daily_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  gestor_id TEXT NOT NULL,
  current_day TEXT NOT NULL DEFAULT 'segunda'
    CHECK (current_day IN ('segunda', 'terca', 'quarta', 'quinta', 'sexta')),
  last_moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_delayed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.crm_daily_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_tracking_all" ON public.crm_daily_tracking;
CREATE POLICY "crm_tracking_all"
  ON public.crm_daily_tracking
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crm_tracking_gestor ON public.crm_daily_tracking(gestor_id);
CREATE INDEX IF NOT EXISTS idx_crm_tracking_day ON public.crm_daily_tracking(current_day);

-- --------- 3) crm_daily_documentation -----------

CREATE TABLE IF NOT EXISTS public.crm_daily_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  gestor_id TEXT NOT NULL,
  documentation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  falou_com_cliente TEXT CHECK (falou_com_cliente IN ('sim', 'nao')),
  falou_justificativa TEXT,
  fez_algo_novo TEXT CHECK (fez_algo_novo IN ('sim', 'nao')),
  fez_algo_justificativa TEXT,
  fez_algo_descricao TEXT,
  combinado TEXT CHECK (combinado IN ('sim', 'nao')),
  combinado_descricao TEXT,
  combinado_prazo DATE,
  combinado_justificativa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, documentation_date)
);

ALTER TABLE public.crm_daily_documentation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_doc_all" ON public.crm_daily_documentation;
CREATE POLICY "crm_doc_all"
  ON public.crm_daily_documentation
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crm_doc_date ON public.crm_daily_documentation(documentation_date);
CREATE INDEX IF NOT EXISTS idx_crm_doc_gestor ON public.crm_daily_documentation(gestor_id);

-- --------- 4) crm_configuracoes -----------
-- Uma linha por (cliente, produto). Cada linha tem sua própria `current_step`,
-- sua própria flag `is_finalizado` e seu próprio snapshot do formulário em JSON.
-- Isso garante independência total entre os cards V8 / Automation / Copilot.

CREATE TABLE IF NOT EXISTS public.crm_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  gestor_id TEXT NOT NULL,
  produto TEXT NOT NULL CHECK (produto IN ('v8', 'automation', 'copilot')),
  current_step TEXT NOT NULL DEFAULT 'criar_pipeline',
  is_finalizado BOOLEAN NOT NULL DEFAULT false,
  finalizado_at TIMESTAMPTZ,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, produto)
);

ALTER TABLE public.crm_configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_config_all" ON public.crm_configuracoes;
CREATE POLICY "crm_config_all"
  ON public.crm_configuracoes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crm_config_client ON public.crm_configuracoes(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_config_gestor ON public.crm_configuracoes(gestor_id);
CREATE INDEX IF NOT EXISTS idx_crm_config_step
  ON public.crm_configuracoes(produto, current_step)
  WHERE is_finalizado = false;
CREATE INDEX IF NOT EXISTS idx_crm_config_finalizado
  ON public.crm_configuracoes(is_finalizado, finalizado_at DESC);
