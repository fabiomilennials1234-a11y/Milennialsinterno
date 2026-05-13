-- RPC: get_public_mktplace_relatorio
-- Returns a single published mktplace_relatorio by public_token,
-- with client name and consultor name denormalized.
-- SECURITY DEFINER bypasses RLS so anon can call this without
-- needing SELECT on clients/profiles directly.

CREATE OR REPLACE FUNCTION public.get_public_mktplace_relatorio(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF _token IS NULL OR _token = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'client_id', r.client_id,
    'consultor_id', r.consultor_id,
    'report_type', r.report_type,
    'titulo', r.titulo,
    'resumo', r.resumo,
    'acoes_realizadas', r.acoes_realizadas,
    'resultados', r.resultados,
    'metricas_chave', r.metricas_chave,
    'pontos_melhoria', r.pontos_melhoria,
    'proximos_passos', r.proximos_passos,
    'observacoes', r.observacoes,
    'feedback_cliente', r.feedback_cliente,
    'saude_contas', r.saude_contas,
    'status_logistica', r.status_logistica,
    'situacao_estoque', r.situacao_estoque,
    'cycle_start_date', r.cycle_start_date,
    'cycle_end_date', r.cycle_end_date,
    'public_token', r.public_token,
    'is_published', r.is_published,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'client_name', c.name,
    'client_razao_social', c.razao_social,
    'consultor_name', p.full_name
  )
  INTO v_result
  FROM mktplace_relatorios r
  LEFT JOIN clients c ON c.id = r.client_id
  LEFT JOIN profiles p ON p.id = r.consultor_id::uuid
  WHERE r.public_token = _token
    AND r.is_published = true
  LIMIT 1;

  RETURN v_result;
END
$$;

REVOKE ALL ON FUNCTION public.get_public_mktplace_relatorio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_mktplace_relatorio(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_mktplace_relatorio(text) TO authenticated;
