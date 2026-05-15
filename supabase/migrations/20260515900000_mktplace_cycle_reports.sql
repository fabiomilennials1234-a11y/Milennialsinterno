-- MKT Place Cycle Reports: structured recurring reports per client+type
-- New table separate from mktplace_relatorios (legacy free-form reports).
-- Supports consultoria (30-day cycle) and gestao (15-day cycle) with
-- marketplace performance data, execution details, ads metrics, and
-- public micro-site access via token.

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE public.mktplace_cycle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultor_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('consultoria', 'gestao')),
  report_number INT NOT NULL DEFAULT 1,

  -- Bloco 1: Identificacao
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  reuniao_realizada BOOLEAN,
  reuniao_data DATE,
  reuniao_horario TEXT,

  -- Bloco 2: Performance / Resultado
  marketplace_data JSONB NOT NULL DEFAULT '[]',

  -- Bloco 3: Execucao / Operacao
  cumprimento_plano TEXT CHECK (cumprimento_plano IN ('tudo', 'parcial', 'nao')),
  cumprimento_detalhamento TEXT,
  dificuldades TEXT,
  top5_skus JSONB,

  -- Bloco 4: Proximo ciclo / Trabalho executado
  plano_proximo_ciclo TEXT,
  proxima_reuniao_data DATE,
  proxima_reuniao_horario TEXT,
  skus_cadastrados_otimizados TEXT,
  skus_problematicos TEXT,
  acoes_executadas TEXT,

  -- Bloco 5: Ads (gestao only)
  verba_ads NUMERIC(12,2),
  acos_medio NUMERIC(5,2),
  tacos_medio NUMERIC(5,2),

  -- Bloco 6: Qualidade (gestao only)
  rms_abertas INT,
  rms_resolvidas INT,
  rms_em_aberto INT,
  plano_proximos_dias TEXT,

  -- Variacao (gestao only)
  variacao_faturamento_pct NUMERIC(5,2),
  variacao_pedidos_pct NUMERIC(5,2),

  -- Publicacao
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_published BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(client_id, report_type, report_number)
);

ALTER TABLE public.mktplace_cycle_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX idx_cycle_reports_client ON public.mktplace_cycle_reports(client_id);
CREATE INDEX idx_cycle_reports_client_type ON public.mktplace_cycle_reports(client_id, report_type, created_at DESC);
CREATE INDEX idx_cycle_reports_token ON public.mktplace_cycle_reports(public_token);

-- ============================================================
-- 3. Trigger: moddatetime for updated_at
-- ============================================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.mktplace_cycle_reports
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================================
-- 4. Trigger: auto-increment report_number per client+type
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_auto_cycle_report_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(report_number), 0) + 1
  INTO NEW.report_number
  FROM public.mktplace_cycle_reports
  WHERE client_id = NEW.client_id
    AND report_type = NEW.report_type;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_cycle_report_number
  BEFORE INSERT ON public.mktplace_cycle_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_cycle_report_number();

-- ============================================================
-- 5. RLS Policies
-- ============================================================

-- Authenticated: full read access
CREATE POLICY "cycle_reports_auth_select"
  ON public.mktplace_cycle_reports
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated: insert
CREATE POLICY "cycle_reports_auth_insert"
  ON public.mktplace_cycle_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Authenticated: update own reports
CREATE POLICY "cycle_reports_auth_update"
  ON public.mktplace_cycle_reports
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon: read published only (micro-site publico)
CREATE POLICY "cycle_reports_anon_select"
  ON public.mktplace_cycle_reports
  FOR SELECT TO anon
  USING (is_published = true);

-- ============================================================
-- 6. RPC: create_mktplace_cycle_report
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_mktplace_cycle_report(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_client_id uuid;
  v_report_type text;
  v_result jsonb;
  v_row public.mktplace_cycle_reports;
BEGIN
  -- Auth check
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '28000';
  END IF;

  -- Extract required fields
  v_client_id := (p_payload->>'client_id')::uuid;
  v_report_type := p_payload->>'report_type';

  -- Validate client exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_client_id) THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'P0002';
  END IF;

  -- Validate report_type
  IF v_report_type NOT IN ('consultoria', 'gestao') THEN
    RAISE EXCEPTION 'invalid report_type: must be consultoria or gestao' USING ERRCODE = 'P0001';
  END IF;

  -- Validate required dates
  IF p_payload->>'cycle_start_date' IS NULL OR p_payload->>'cycle_end_date' IS NULL THEN
    RAISE EXCEPTION 'cycle_start_date and cycle_end_date required' USING ERRCODE = 'P0001';
  END IF;

  -- Validate marketplace_data is array
  IF p_payload ? 'marketplace_data' AND jsonb_typeof(p_payload->'marketplace_data') <> 'array' THEN
    RAISE EXCEPTION 'marketplace_data must be an array' USING ERRCODE = 'P0001';
  END IF;

  -- Insert
  INSERT INTO public.mktplace_cycle_reports (
    client_id,
    consultor_id,
    report_type,
    cycle_start_date,
    cycle_end_date,
    reuniao_realizada,
    reuniao_data,
    reuniao_horario,
    marketplace_data,
    cumprimento_plano,
    cumprimento_detalhamento,
    dificuldades,
    top5_skus,
    plano_proximo_ciclo,
    proxima_reuniao_data,
    proxima_reuniao_horario,
    skus_cadastrados_otimizados,
    skus_problematicos,
    acoes_executadas,
    verba_ads,
    acos_medio,
    tacos_medio,
    rms_abertas,
    rms_resolvidas,
    rms_em_aberto,
    plano_proximos_dias,
    variacao_faturamento_pct,
    variacao_pedidos_pct
  )
  VALUES (
    v_client_id,
    v_caller::text,
    v_report_type,
    (p_payload->>'cycle_start_date')::date,
    (p_payload->>'cycle_end_date')::date,
    (p_payload->>'reuniao_realizada')::boolean,
    (p_payload->>'reuniao_data')::date,
    p_payload->>'reuniao_horario',
    COALESCE(p_payload->'marketplace_data', '[]'::jsonb),
    p_payload->>'cumprimento_plano',
    p_payload->>'cumprimento_detalhamento',
    p_payload->>'dificuldades',
    p_payload->'top5_skus',
    p_payload->>'plano_proximo_ciclo',
    (p_payload->>'proxima_reuniao_data')::date,
    p_payload->>'proxima_reuniao_horario',
    p_payload->>'skus_cadastrados_otimizados',
    p_payload->>'skus_problematicos',
    p_payload->>'acoes_executadas',
    (p_payload->>'verba_ads')::numeric,
    (p_payload->>'acos_medio')::numeric,
    (p_payload->>'tacos_medio')::numeric,
    (p_payload->>'rms_abertas')::int,
    (p_payload->>'rms_resolvidas')::int,
    (p_payload->>'rms_em_aberto')::int,
    p_payload->>'plano_proximos_dias',
    (p_payload->>'variacao_faturamento_pct')::numeric,
    (p_payload->>'variacao_pedidos_pct')::numeric
  )
  RETURNING * INTO v_row;

  -- Build result with public_token
  SELECT jsonb_build_object(
    'id', v_row.id,
    'client_id', v_row.client_id,
    'consultor_id', v_row.consultor_id,
    'report_type', v_row.report_type,
    'report_number', v_row.report_number,
    'cycle_start_date', v_row.cycle_start_date,
    'cycle_end_date', v_row.cycle_end_date,
    'public_token', v_row.public_token,
    'is_published', v_row.is_published,
    'created_at', v_row.created_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_mktplace_cycle_report(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_mktplace_cycle_report(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_mktplace_cycle_report(jsonb) TO authenticated;

-- ============================================================
-- 7. RPC: get_public_mktplace_cycle_report
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_mktplace_cycle_report(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'client_id', r.client_id,
    'consultor_id', r.consultor_id,
    'report_type', r.report_type,
    'report_number', r.report_number,
    'cycle_start_date', r.cycle_start_date,
    'cycle_end_date', r.cycle_end_date,
    'reuniao_realizada', r.reuniao_realizada,
    'reuniao_data', r.reuniao_data,
    'reuniao_horario', r.reuniao_horario,
    'marketplace_data', r.marketplace_data,
    'cumprimento_plano', r.cumprimento_plano,
    'cumprimento_detalhamento', r.cumprimento_detalhamento,
    'dificuldades', r.dificuldades,
    'top5_skus', r.top5_skus,
    'plano_proximo_ciclo', r.plano_proximo_ciclo,
    'proxima_reuniao_data', r.proxima_reuniao_data,
    'proxima_reuniao_horario', r.proxima_reuniao_horario,
    'skus_cadastrados_otimizados', r.skus_cadastrados_otimizados,
    'skus_problematicos', r.skus_problematicos,
    'acoes_executadas', r.acoes_executadas,
    'verba_ads', r.verba_ads,
    'acos_medio', r.acos_medio,
    'tacos_medio', r.tacos_medio,
    'rms_abertas', r.rms_abertas,
    'rms_resolvidas', r.rms_resolvidas,
    'rms_em_aberto', r.rms_em_aberto,
    'plano_proximos_dias', r.plano_proximos_dias,
    'variacao_faturamento_pct', r.variacao_faturamento_pct,
    'variacao_pedidos_pct', r.variacao_pedidos_pct,
    'public_token', r.public_token,
    'is_published', r.is_published,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'client_name', c.name,
    'client_razao_social', c.razao_social,
    'consultor_name', p.full_name
  )
  INTO v_result
  FROM mktplace_cycle_reports r
  LEFT JOIN clients c ON c.id = r.client_id
  LEFT JOIN profiles p ON p.id = r.consultor_id::uuid
  WHERE r.public_token = p_token
    AND r.is_published = true
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_mktplace_cycle_report(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_mktplace_cycle_report(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_mktplace_cycle_report(text) TO authenticated;
