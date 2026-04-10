-- =============================================================
-- MKT Place Diagnósticos: formulário + resultado do diagnóstico
-- =============================================================

CREATE TABLE IF NOT EXISTS public.mktplace_diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultor_id TEXT NOT NULL,

  -- Bloco 1 — Informações gerais
  cliente_nome TEXT,
  responsavel_diagnostico TEXT,
  data_consultoria DATE,
  marketplace_principal TEXT,
  outros_marketplaces TEXT,
  categoria_principal TEXT,
  ticket_medio NUMERIC,
  quantidade_skus INTEGER,
  faturamento_atual NUMERIC,
  meta_faturamento NUMERIC,
  observacoes_gerais TEXT,

  -- Bloco 2 — Estrutura da operação
  operacao_organizada TEXT CHECK (operacao_organizada IN ('sim', 'parcialmente', 'nao')),
  responsavel_interno TEXT CHECK (responsavel_interno IN ('sim', 'nao')),
  responde_rapido TEXT CHECK (responde_rapido IN ('sim', 'parcialmente', 'nao')),
  rotina_metricas TEXT CHECK (rotina_metricas IN ('sim', 'parcialmente', 'nao')),
  depende_uma_pessoa TEXT CHECK (depende_uma_pessoa IN ('sim', 'nao')),
  processo_claro TEXT CHECK (processo_claro IN ('sim', 'parcialmente', 'nao')),
  obs_estrutura TEXT,

  -- Bloco 3 — Cadastro e qualidade dos anúncios
  titulos_bons TEXT CHECK (titulos_bons IN ('sim', 'parcialmente', 'nao')),
  descricoes_boas TEXT CHECK (descricoes_boas IN ('sim', 'parcialmente', 'nao')),
  imagens_profissionais TEXT CHECK (imagens_profissionais IN ('sim', 'parcialmente', 'nao')),
  padronizacao_visual TEXT CHECK (padronizacao_visual IN ('sim', 'parcialmente', 'nao')),
  ficha_tecnica_completa TEXT CHECK (ficha_tecnica_completa IN ('sim', 'parcialmente', 'nao')),
  cadastro_fraco TEXT CHECK (cadastro_fraco IN ('sim', 'nao')),
  diferenciais_claros TEXT CHECK (diferenciais_claros IN ('sim', 'parcialmente', 'nao')),
  obs_anuncios TEXT,

  -- Bloco 4 — Preço e competitividade
  precos_competitivos TEXT CHECK (precos_competitivos IN ('sim', 'parcialmente', 'nao')),
  entende_margem TEXT CHECK (entende_margem IN ('sim', 'parcialmente', 'nao')),
  estrategia_precificacao TEXT CHECK (estrategia_precificacao IN ('sim', 'parcialmente', 'nao')),
  acompanha_concorrentes TEXT CHECK (acompanha_concorrentes IN ('sim', 'parcialmente', 'nao')),
  frete_impacta TEXT CHECK (frete_impacta IN ('sim', 'parcialmente', 'nao')),
  obs_preco TEXT,

  -- Bloco 5 — Estoque e logística
  estoque_sincronizado TEXT CHECK (estoque_sincronizado IN ('sim', 'parcialmente', 'nao')),
  ruptura_frequente TEXT CHECK (ruptura_frequente IN ('sim', 'nao')),
  prazo_envio_bom TEXT CHECK (prazo_envio_bom IN ('sim', 'parcialmente', 'nao')),
  logistica_prejudica TEXT CHECK (logistica_prejudica IN ('sim', 'parcialmente', 'nao')),
  cancelamentos_falha TEXT CHECK (cancelamentos_falha IN ('sim', 'parcialmente', 'nao')),
  obs_estoque TEXT,

  -- Bloco 6 — Conversão e performance
  conversao_saudavel TEXT CHECK (conversao_saudavel IN ('sim', 'parcialmente', 'nao')),
  acompanha_metricas_conv TEXT CHECK (acompanha_metricas_conv IN ('sim', 'parcialmente', 'nao')),
  produtos_visita_convertem TEXT CHECK (produtos_visita_convertem IN ('sim', 'parcialmente', 'nao')),
  potencial_mal_aproveitado TEXT CHECK (potencial_mal_aproveitado IN ('sim', 'nao')),
  otimizacao_continua TEXT CHECK (otimizacao_continua IN ('sim', 'parcialmente', 'nao')),
  obs_conversao TEXT,

  -- Bloco 7 — Reputação e atendimento
  reputacao_saudavel TEXT CHECK (reputacao_saudavel IN ('sim', 'parcialmente', 'nao')),
  atendimento_bom TEXT CHECK (atendimento_bom IN ('sim', 'parcialmente', 'nao')),
  tempo_resposta_adequado TEXT CHECK (tempo_resposta_adequado IN ('sim', 'parcialmente', 'nao')),
  muitas_reclamacoes TEXT CHECK (muitas_reclamacoes IN ('sim', 'parcialmente', 'nao')),
  obs_reputacao TEXT,

  -- Bloco 8 — Tráfego e crescimento
  usa_midia_paga TEXT CHECK (usa_midia_paga IN ('sim', 'nao')),
  midia_estrategica TEXT CHECK (midia_estrategica IN ('sim', 'parcialmente', 'nao')),
  estrategia_crescimento TEXT CHECK (estrategia_crescimento IN ('sim', 'parcialmente', 'nao')),
  priorizacao_potencial TEXT CHECK (priorizacao_potencial IN ('sim', 'parcialmente', 'nao')),
  plano_escalar TEXT CHECK (plano_escalar IN ('sim', 'parcialmente', 'nao')),
  obs_crescimento TEXT,

  -- Bloco 9 — Prioridades definidas na consultoria
  principais_gargalos TEXT,
  principais_oportunidades TEXT,
  corrigir_imediatamente TEXT,
  melhorar_medio_prazo TEXT,
  gerar_faturamento_rapido TEXT,
  observacoes_finais TEXT,

  -- Publicação (link público do relatório)
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_published BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mktplace_diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mktplace_diag_all" ON mktplace_diagnosticos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mktplace_diag_public" ON mktplace_diagnosticos FOR SELECT TO anon USING (is_published = true);

CREATE INDEX idx_mktplace_diag_client ON mktplace_diagnosticos(client_id);
CREATE INDEX idx_mktplace_diag_consultor ON mktplace_diagnosticos(consultor_id);
CREATE INDEX idx_mktplace_diag_created ON mktplace_diagnosticos(created_at DESC);
CREATE INDEX idx_mktplace_diag_token ON mktplace_diagnosticos(public_token);
