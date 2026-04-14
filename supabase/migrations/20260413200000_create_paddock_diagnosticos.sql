-- =============================================================
-- Paddock Diagnóstico Comercial pós War #2
-- =============================================================

CREATE TABLE IF NOT EXISTS public.paddock_diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultor_id TEXT NOT NULL,

  -- Bloco 1: Execução Real
  exec_batendo_50 TEXT,
  exec_consistencia_diaria TEXT,
  exec_comeca_pelo_crm TEXT,
  exec_blocos_ligacao TEXT,
  exec_volume_caiu TEXT,
  exec_alguem_nao_performa TEXT,
  exec_followup_diario TEXT,
  exec_leads_sem_atividade TEXT,

  -- Bloco 2: Uso do CRM
  crm_movimentacao_correta TEXT,
  crm_leads_parados TEXT,
  crm_registra_interacoes TEXT,
  crm_historico_completo TEXT,
  crm_whatsapp_fora TEXT,
  crm_erros_status TEXT,
  crm_funil_realidade TEXT,
  crm_gestor_confia TEXT,
  crm_principal_erro TEXT,

  -- Bloco 3: Abordagem Inicial
  abord_liga_imediatamente TEXT,
  abord_tempo_resposta_5min TEXT,
  abord_comeca_whatsapp TEXT,
  abord_ligacoes_frequentes TEXT,
  abord_seguranca_falar TEXT,
  abord_abertura_estruturada TEXT,
  abord_faz_perguntas TEXT,
  abord_fala_mais_que_escuta TEXT,
  abord_erro_ligacoes TEXT,

  -- Bloco 4: Qualificação
  qual_perguntas_cenario TEXT,
  qual_dor_real TEXT,
  qual_fala_decisor TEXT,
  qual_descobre_orcamento TEXT,
  qual_entende_prazo TEXT,
  qual_qualifica_ou_empurra TEXT,
  qual_perde_tempo_ruins TEXT,
  qual_diferencia_status TEXT,
  qual_erro_qualificacao TEXT,

  -- Bloco 5: Follow-up
  follow_5_tentativas TEXT,
  follow_multicanal TEXT,
  follow_personalizado TEXT,
  follow_desiste_rapido TEXT,
  follow_padrao_dias TEXT,
  follow_revisita_antigos TEXT,
  follow_registra_crm TEXT,
  follow_disciplina TEXT,
  follow_erro_followup TEXT,

  -- Bloco 6: Conversão
  conv_agenda_reunioes TEXT,
  conv_reunioes_qualificadas TEXT,
  conv_leads_somem TEXT,
  conv_objecao_recorrente TEXT,
  conv_conduz_conversa TEXT,
  conv_valor_ou_preco TEXT,
  conv_quebra_expectativa TEXT,
  conv_inicio_ou_fechamento TEXT,
  conv_erro_conversao TEXT,

  -- Bloco 7: Disciplina e Rotina
  disc_rotina_clara TEXT,
  disc_metas_individuais TEXT,
  disc_mede_desempenho TEXT,
  disc_cobranca_gestor TEXT,
  disc_executa_sem_motivacao TEXT,
  disc_consistencia TEXT,
  disc_sabe_o_que_fazer TEXT,
  disc_organizacao TEXT,
  disc_falta_rotina TEXT,

  -- Bloco 8: Erros Críticos
  erro_liga_pouco TEXT,
  erro_comeca_whatsapp TEXT,
  erro_nao_registra TEXT,
  erro_fala_mais TEXT,
  erro_nao_investiga TEXT,
  erro_aceita_nao TEXT,
  erro_nao_agenda TEXT,
  erro_nao_segue TEXT,
  erro_mais_prejudica TEXT,

  -- Bloco 9: Evolução Real
  evol_melhorou TEXT,
  evol_gestor_percebe TEXT,
  evol_aplicou TEXT,
  evol_aumento_reunioes TEXT,
  evol_qualidade_leads TEXT,
  evol_mais_organizado TEXT,
  evol_crm_limpo TEXT,
  evol_processo_claro TEXT,
  evol_o_que_melhorou TEXT,
  evol_o_que_nao_melhorou TEXT,
  evol_top3_gargalos TEXT,
  evol_top3_acoes TEXT,

  -- Publicação (link público do relatório)
  public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_published BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paddock_diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "paddock_diag_all" ON paddock_diagnosticos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "paddock_diag_public" ON paddock_diagnosticos FOR SELECT TO anon USING (is_published = true);

CREATE INDEX idx_paddock_diag_client ON paddock_diagnosticos(client_id);
CREATE INDEX idx_paddock_diag_consultor ON paddock_diagnosticos(consultor_id);
CREATE INDEX idx_paddock_diag_created ON paddock_diagnosticos(created_at DESC);
CREATE INDEX idx_paddock_diag_token ON paddock_diagnosticos(public_token);
