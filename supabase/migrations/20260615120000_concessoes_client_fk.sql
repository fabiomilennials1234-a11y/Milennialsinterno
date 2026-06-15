-- 20260615120000_concessoes_client_fk.sql
--
-- FIX (read-path quebrado): a lista de /concessoes vinha SEMPRE VAZIA para todos
-- os papéis. Causa raiz: public.concessoes NÃO tinha FK de client_id -> clients.id,
-- então o PostgREST não resolvia o embed `client:clients(id,name)` usado em
-- src/hooks/useConcessoes.ts e retornava HTTP 400 (PGRST200 — "Could not find a
-- relationship"). A escrita estava correta (a linha existe no DB); faltava só a
-- relação para o JOIN aninhado funcionar.
--
-- POR QUE ESTA FK (e não manter "uuid solto" do ADR 0004):
-- O schema original (20260608130000) omitiu deliberadamente a FK por "contract-only
-- / uuid solto" (ADR 0004). Essa omissão derrubou uma feature load-bearing — o
-- embed do PostgREST depende de uma FK declarada. O arquiteto autorizou adicionar
-- a FK. Esta migration é o override explícito da omissão do ADR 0004 PARA ESTA
-- relação concessoes -> clients: a integridade referencial passa a ser garantida
-- pelo banco (mais forte que validação só na RPC + reconciliação) E habilita o
-- read-path. As demais referências por uuid solto (granted_by) seguem inalteradas.
--
-- ON DELETE CASCADE — por consistência com o padrão do projeto, NÃO por preferência:
--   Levantamento em pg_constraint (FKs -> public.clients): 61 CASCADE, 7 SET NULL,
--   0 RESTRICT/NO ACTION. A irmã direta `upsells` (ADR 0009 — Concessão é o paralelo
--   da Upsell) e todo o módulo financeiro (mrr_changes, commission_records,
--   financeiro_*) usam CASCADE. Clients são soft-deleted na prática (hard-delete é
--   raríssimo); no hard-delete, remover a concessão órfã é melhor que deixá-la
--   apontando para um cliente inexistente. Introduzir RESTRICT aqui seria o único
--   de 68 FKs a divergir, sem benefício. consistência > preferência (CLAUDE.md).
--
-- SEGURO SEM LIMPEZA: verificado no remoto que há 0 órfãos (todo concessoes.client_id
--   já casa com clients.id). client_id é uuid NOT NULL — tipo casa com clients.id.
--   FK criada VALID direto (sem NOT NULL/NOT VALID). Índice idx_concessoes_client_id
--   já existe (criado em 20260608130000), então o CASCADE não vira seq scan.

BEGIN;

ALTER TABLE public.concessoes
  ADD CONSTRAINT concessoes_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES public.clients(id)
  ON DELETE CASCADE;

COMMENT ON COLUMN public.concessoes.client_id IS
  'Referência ao cliente (clients.id) com FK ON DELETE CASCADE. Override explícito '
  'da omissão de FK do ADR 0004 para esta relação: a integridade é garantida pelo '
  'banco E habilita o embed client:clients(id,name) do PostgREST (read-path da lista '
  'de concessões). CASCADE por consistência com upsells/financeiro (padrão do projeto).';

COMMIT;
