-- Fix get_public_mktplace_cycle_report RPC:
-- 1. p.full_name does not exist on profiles table (column is "name")
-- 2. JOIN profiles p ON p.id should be p.user_id (consultor_id stores auth uid)

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
    'consultor_name', p.name
  )
  INTO v_result
  FROM mktplace_cycle_reports r
  LEFT JOIN clients c ON c.id = r.client_id
  LEFT JOIN profiles p ON p.user_id = r.consultor_id::uuid
  WHERE r.public_token = p_token
    AND r.is_published = true
  LIMIT 1;

  RETURN v_result;
END;
$$;
