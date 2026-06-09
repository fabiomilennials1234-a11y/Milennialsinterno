-- 20260608180000_concessao_converter_rpc.sql
--
-- Slice #151 (Concessão — CONVERTER) — ADR 0009. TRANSIÇÃO FINANCEIRA: a
-- retenção vingou e o cliente passa a PAGAR pelo produto concedido. Forma 1
-- (aprovada pelo fundador): cria uma linha REAL em public.upsells (o trigger
-- process_upsell gera a comissão 7%), mas PULA a entrega via SET LOCAL
-- app.skip_entrega='on' — o produto já foi entregue ao conceder (#147), re-entregar
-- duplicaria card de board e linhas financeiro. Espelha o padrão de conceder_produto.
--
-- O QUE FAZ public.converter_concessao(p_concessao_id, p_monthly_value, p_sold_by) -> uuid:
--   1. Carrega a concessão; não existe -> P0001.
--   2. Autoriza por _concessao_pode_conceder (admin OU CS dono da carteira) -> 42501.
--   3. Guard de estado: só `ativa` converte; senão P0001.
--   4. Guard de valor: p_monthly_value <= 0 -> P0001 (conversão é venda, exige > 0).
--   5. Valida p_sold_by: precisa ser admin OU sucesso_cliente -> senão P0001
--      (a comissão vai pra essa pessoa; não pode apontar pra quem não vende).
--   6. INSERE em upsells (status='contracted') com SET LOCAL app.skip_entrega='on'
--      -> trigger gera comissão 7% e PULA a entrega (já entregue ao conceder).
--   7. Registra a expansão de MRR (mrr_changes: 0 -> p_monthly_value).
--   8. Atualiza o valor real nas linhas financeiro existentes (active_clients +
--      client_product_values) — o conceder gravou 0; agora reflete o valor pago.
--   9. Marca concessoes.status='convertida', converted_to_upsell_id = id do upsell.
--   Retorna o id do upsell criado.
--
-- ANTI-DUPLICAÇÃO (assert central): NENHUM card novo de board é criado — o
--   app.skip_entrega faz process_upsell pular _entregar_produto. O card existente
--   (criado ao conceder) permanece; a conversão não toca cards.
--
-- HARDENING (ADR 0004 §3): SECURITY DEFINER bypassa RLS -> re-checa autorização.
--   app.skip_entrega é SET LOCAL (escopo da TRANSAÇÃO). A RPC a LIGA só em volta do
--   INSERT do upsell e a DESLIGA logo após — assim nunca contamina INSERTs de venda
--   normal subsequentes na MESMA transação (caso o chamador agrupe operações).
--   Grants mínimos: só authenticated executa.

BEGIN;

CREATE OR REPLACE FUNCTION public.converter_concessao(
  p_concessao_id  uuid,
  p_monthly_value numeric,
  p_sold_by       uuid
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
  v_product_name text;
  v_status       public.concessao_status;
  v_sold_by_name text;
  v_upsell_id    uuid;
BEGIN
  -- 1. Carrega a concessão (anti-órfão: não existe -> P0001).
  SELECT co.client_id, co.product_slug, co.product_name, co.status
    INTO v_client_id, v_product_slug, v_product_name, v_status
  FROM public.concessoes co
  WHERE co.id = p_concessao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'concessão % não existe', p_concessao_id USING ERRCODE = 'P0001';
  END IF;

  -- 2. Autorização (ADR 0009 §3). SECURITY DEFINER bypassa RLS -> re-checar.
  IF NOT public._concessao_pode_conceder(v_client_id, v_caller) THEN
    RAISE EXCEPTION 'permission denied: caller não pode converter concessão deste cliente'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Guard de estado: só `ativa` converte.
  IF v_status <> 'ativa'::public.concessao_status THEN
    RAISE EXCEPTION 'concessão % não está ativa (status=%): nada a converter',
      p_concessao_id, v_status USING ERRCODE = 'P0001';
  END IF;

  -- 4. Guard de valor: conversão é venda -> exige valor positivo.
  IF p_monthly_value IS NULL OR p_monthly_value <= 0 THEN
    RAISE EXCEPTION 'conversão exige monthly_value > 0 (recebido: %)', p_monthly_value
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Valida p_sold_by: a comissão vai pra essa pessoa -> precisa poder vender
  --    (admin OU sucesso_cliente). Resolve o nome na MESMA passada (profiles.name).
  IF NOT (
    public.is_admin(p_sold_by)
    OR public.has_role(p_sold_by, 'sucesso_cliente'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'sold_by % não pode receber comissão (não é admin nem sucesso_cliente)',
      p_sold_by USING ERRCODE = 'P0001';
  END IF;

  SELECT pr.name INTO v_sold_by_name
  FROM public.profiles pr
  WHERE pr.user_id = p_sold_by;

  -- ===== Guards passaram; só escrita daqui (atômico). =====

  -- 6. Cria o upsell REAL. A flag liga o galho skip-entrega do trigger SÓ para
  --    este INSERT; reativamos logo após. CRÍTICO: SET LOCAL é escopado à
  --    TRANSAÇÃO, não à função — em produção cada RPC é sua própria transação
  --    (autocommit), mas se o chamador abrir uma transação maior (ex.: outra RPC,
  --    um teste) a flag VAZARIA para INSERTs de upsell subsequentes, fazendo venda
  --    normal pular a entrega. Por isso desligamos explicitamente após o INSERT —
  --    a RPC é autossuficiente e nunca contamina o resto da transação.
  SET LOCAL app.skip_entrega = 'on';

  INSERT INTO public.upsells (
    client_id, product_slug, product_name, monthly_value, sold_by, sold_by_name, status
  ) VALUES (
    v_client_id, v_product_slug, v_product_name, p_monthly_value, p_sold_by,
    COALESCE(v_sold_by_name, 'Desconhecido'), 'contracted'
  )
  RETURNING id INTO v_upsell_id;

  SET LOCAL app.skip_entrega = 'off';

  -- 7. Expansão de MRR: 0 (concedido) -> p_monthly_value (pago). source dedicado
  --    para rastrear conversões de concessão no histórico financeiro.
  INSERT INTO public.mrr_changes (
    client_id, product_slug, product_name,
    previous_value, new_value, change_value, change_type, source, changed_by
  ) VALUES (
    v_client_id, v_product_slug, v_product_name,
    0, p_monthly_value, p_monthly_value, 'expansion', 'concessao_conversao', v_caller
  );

  -- 8. Reflete o valor REAL nas linhas financeiro que o conceder gravou com 0.
  UPDATE public.financeiro_active_clients
     SET monthly_value = p_monthly_value, updated_at = now()
   WHERE client_id = v_client_id AND product_slug = v_product_slug;

  UPDATE public.client_product_values
     SET monthly_value = p_monthly_value, updated_at = now()
   WHERE client_id = v_client_id AND product_slug = v_product_slug;

  -- 9. Marca a concessão convertida e vincula ao upsell criado (audit).
  UPDATE public.concessoes
     SET status = 'convertida'::public.concessao_status,
         converted_to_upsell_id = v_upsell_id
   WHERE id = p_concessao_id;

  RETURN v_upsell_id;
END;
$$;

COMMENT ON FUNCTION public.converter_concessao(uuid, numeric, uuid) IS
  'Contrato de CONVERSÃO da Concessão (ADR 0009, Slice #151, Forma 1): a retenção '
  'vingou, o cliente passa a pagar. Cria upsell REAL (status=contracted) com SET LOCAL '
  'app.skip_entrega=on -> trigger gera comissão 7% e PULA a entrega (já entregue ao '
  'conceder, #147 — re-entregar duplicaria card/linhas). Registra expansão de MRR '
  '(0 -> valor, source=concessao_conversao), atualiza o valor real em '
  'financeiro_active_clients + client_product_values, marca a concessão `convertida` e '
  'vincula converted_to_upsell_id. Autoriza por _concessao_pode_conceder (admin OU CS '
  'dono). Guards (existência/autorização/status/valor>0/sold_by vendável) RAISE antes '
  'de qualquer escrita (atômico). NENHUM card novo é criado. Retorna o id do upsell.';

-- Grants (espelha conceder_produto): só authenticated executa a RPC.
REVOKE ALL ON FUNCTION public.converter_concessao(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.converter_concessao(uuid, numeric, uuid) TO authenticated;

COMMIT;
