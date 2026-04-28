-- Reformulação do "Formulário da Call" do card do cliente em 7 blocos.
-- Adiciona 28 novas colunas text NULL em client_call_forms.
-- RLS preservada — não tocamos policies. Só ALTER ADD COLUMN.
-- Total esperado pós-migration: 17 (existentes) + 28 (novos) = 45 campos de formulário.

ALTER TABLE public.client_call_forms
  -- Bloco 1 — Empresa, Produto e Margem (6 novos)
  ADD COLUMN IF NOT EXISTS principais_produtos_margem text NULL,
  ADD COLUMN IF NOT EXISTS produto_carro_chefe text NULL,
  ADD COLUMN IF NOT EXISTS ticket_medio text NULL,
  ADD COLUMN IF NOT EXISTS margem_media text NULL,
  ADD COLUMN IF NOT EXISTS pedido_minimo text NULL,
  ADD COLUMN IF NOT EXISTS condicao_distribuidor_representante text NULL,

  -- Bloco 2 — Cliente Ideal e Mercado (5 novos)
  ADD COLUMN IF NOT EXISTS decisor_compra_cliente text NULL,
  ADD COLUMN IF NOT EXISTS diferencial_vs_concorrencia text NULL,
  ADD COLUMN IF NOT EXISTS maior_dor_empresa text NULL,
  ADD COLUMN IF NOT EXISTS concorrente_direto_n1 text NULL,
  ADD COLUMN IF NOT EXISTS feiras_eventos_setor text NULL,

  -- Bloco 3 — Comercial e Operação (8 novos)
  ADD COLUMN IF NOT EXISTS representantes_comerciais_atual text NULL,
  ADD COLUMN IF NOT EXISTS captar_novos_representantes text NULL,
  ADD COLUMN IF NOT EXISTS tempo_ciclo_venda text NULL,
  ADD COLUMN IF NOT EXISTS tempo_resposta_lead text NULL,
  ADD COLUMN IF NOT EXISTS origem_clientes_atuais text NULL,
  ADD COLUMN IF NOT EXISTS recompra_frequencia text NULL,
  ADD COLUMN IF NOT EXISTS programa_indicacao text NULL,
  ADD COLUMN IF NOT EXISTS cnpjs_ativos text NULL,

  -- Bloco 4 — Marketing e Presença Digital (2 novos)
  ADD COLUMN IF NOT EXISTS catalogo_fotos_videos text NULL,
  ADD COLUMN IF NOT EXISTS restricoes_comunicacao text NULL,

  -- Bloco 5 — Marketplace (3 novos)
  ADD COLUMN IF NOT EXISTS vende_marketplaces text NULL,
  ADD COLUMN IF NOT EXISTS marketplaces_ativos text NULL,
  ADD COLUMN IF NOT EXISTS faturamento_marketplaces text NULL,

  -- Bloco 6 — Foco, Objetivo e Expectativa (3 novos)
  ADD COLUMN IF NOT EXISTS foco_principal_empresa text NULL,
  ADD COLUMN IF NOT EXISTS objetivo_contratar_milennials text NULL,
  ADD COLUMN IF NOT EXISTS satisfacao_3_meses text NULL,

  -- Bloco 7 — Projeto e Execução (1 novo)
  ADD COLUMN IF NOT EXISTS ponto_focal_cliente text NULL;
