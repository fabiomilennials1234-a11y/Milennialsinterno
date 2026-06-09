-- 20260608170000_concessao_revogar_rpc.sql
--
-- Slice #150 (Concessão — REVOGAR) — ADR 0009. TEARDOWN: o cliente perdeu o
-- produto concedido (não vingou a retenção). Desfaz a ENTREGA feita ao conceder
-- (#147) e marca a concessão `revogada`. Espelha o padrão de conceder_produto:
-- predicado dedicado, SECURITY DEFINER + search_path='', schema-qualified, guards
-- RAISE-antes-de-escrita (atômico, zero efeito parcial), 42501/P0001.
--
-- O QUE FAZ public.revogar_concessao(p_concessao_id, p_revoke_reason?) -> uuid:
--   1. Carrega a concessão; não existe -> P0001.
--   2. Autoriza por _concessao_pode_conceder (admin OU CS dono da carteira) -> 42501.
--   3. Guard de estado: só concessão `ativa` revoga; senão P0001.
--   4. ARQUIVA o card de board do produto (mais recente, card_type='upsell',
--      archived=false). Pula produtos sem board (ex.: millennials-growth).
--   5. Remove o slug de clients.contracted_products.
--   6. DELETA as linhas financeiro do par (client_id, product_slug):
--      financeiro_active_clients + financeiro_client_onboarding + client_product_values.
--      (financeiro_active_clients não tem flag de "ativo" — inativar = DELETE.)
--   7. Marca concessoes.status='revogada', revoked_by/revoked_at.
--   Retorna o id da concessão revogada.
--
-- p_revoke_reason: aceito por compat de assinatura mas IGNORADO no v1 (YAGNI,
--   decisão do arquiteto — não há coluna de motivo de revogação; quando houver
--   demanda real, vira ALTER + passa a gravar). Documentado, não silencioso.
--
-- DIVERGÊNCIA DO SPEC POR REALIDADE DO SCHEMA: kanban_cards NÃO possui coluna
--   archived_by (só archived + archived_at). O UPDATE grava archived=true,
--   archived_at=now() — sem archived_by. (Confirmado por introspecção do remoto.)
--
-- HARDENING (ADR 0004 §3): SECURITY DEFINER bypassa RLS -> re-checa autorização
--   aqui. Grants mínimos: só authenticated executa.

BEGIN;

CREATE OR REPLACE FUNCTION public.revogar_concessao(
  p_concessao_id  uuid,
  p_revoke_reason text DEFAULT NULL  -- v1: aceito mas ignorado (YAGNI, sem coluna).
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_client_id    uuid;
  v_product_slug text;
  v_status       public.concessao_status;
  v_board_id     uuid;
BEGIN
  -- 1. Carrega a concessão (anti-órfão: não existe -> P0001, nada escrito).
  SELECT co.client_id, co.product_slug, co.status
    INTO v_client_id, v_product_slug, v_status
  FROM public.concessoes co
  WHERE co.id = p_concessao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'concessão % não existe', p_concessao_id USING ERRCODE = 'P0001';
  END IF;

  -- 2. Autorização (ADR 0009 §3). SECURITY DEFINER bypassa RLS -> re-checar.
  IF NOT public._concessao_pode_conceder(v_client_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode revogar concessão deste cliente'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Guard de estado: só `ativa` revoga (convertida/revogada -> erro de operação).
  IF v_status <> 'ativa'::public.concessao_status THEN
    RAISE EXCEPTION 'concessão % não está ativa (status=%): nada a revogar',
      p_concessao_id, v_status USING ERRCODE = 'P0001';
  END IF;

  -- ===== A partir daqui só escrita; todos os guards já passaram (atômico). =====

  -- 4. Arquiva o card de board do produto (o mais recente do cliente nesse board,
  --    card_type='upsell', ainda não arquivado). Produtos sem board (ex.:
  --    millennials-growth) simplesmente não têm card -> v_board_id NULL, pula.
  SELECT b.id INTO v_board_id
  FROM public.kanban_boards b
  WHERE b.slug = v_product_slug
  LIMIT 1;

  IF v_board_id IS NOT NULL THEN
    UPDATE public.kanban_cards kc
       SET archived = true, archived_at = now()
     WHERE kc.id = (
       SELECT kc2.id FROM public.kanban_cards kc2
       WHERE kc2.board_id = v_board_id
         AND kc2.client_id = v_client_id
         AND kc2.card_type = 'upsell'
         AND kc2.archived = false
       ORDER BY kc2.created_at DESC
       LIMIT 1
     );
  END IF;

  -- 5. Remove o slug de contracted_products (cliente deixa de ter o produto).
  UPDATE public.clients
     SET contracted_products = array_remove(
           COALESCE(contracted_products, ARRAY[]::text[]), v_product_slug),
         updated_at = now()
   WHERE id = v_client_id;

  -- 6. DELETA as linhas financeiro do par (inativar = DELETE; sem flag de ativo).
  DELETE FROM public.financeiro_active_clients
   WHERE client_id = v_client_id AND product_slug = v_product_slug;

  DELETE FROM public.financeiro_client_onboarding
   WHERE client_id = v_client_id AND product_slug = v_product_slug;

  DELETE FROM public.client_product_values
   WHERE client_id = v_client_id AND product_slug = v_product_slug;

  -- 7. Marca a concessão revogada (audit).
  UPDATE public.concessoes
     SET status = 'revogada'::public.concessao_status,
         revoked_by = v_caller,
         revoked_at = now()
   WHERE id = p_concessao_id;

  RETURN p_concessao_id;
END;
$$;

COMMENT ON FUNCTION public.revogar_concessao(uuid, text) IS
  'Contrato de TEARDOWN da Concessão (ADR 0009, Slice #150): desfaz a entrega de um '
  'produto concedido e marca a concessão `revogada`. Arquiva o card de board (mais '
  'recente, card_type=upsell), remove o slug de contracted_products, DELETA as linhas '
  'financeiro (active_clients + onboarding + client_product_values) do par '
  '(client_id, product_slug). Autoriza por _concessao_pode_conceder (admin OU CS dono). '
  'Atômico: guards (existência/autorização/status ativa) RAISE antes de qualquer '
  'escrita. p_revoke_reason aceito mas ignorado no v1 (sem coluna; YAGNI). Retorna o id.';

-- Grants (espelha conceder_produto): só authenticated executa a RPC.
REVOKE ALL ON FUNCTION public.revogar_concessao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revogar_concessao(uuid, text) TO authenticated;

COMMIT;
