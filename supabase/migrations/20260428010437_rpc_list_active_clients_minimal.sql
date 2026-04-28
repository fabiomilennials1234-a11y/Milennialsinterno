-- 20260428010437_rpc_list_active_clients_minimal.sql
--
-- Contexto: o modal "Gerar Tarefa" do CRM (CrmTarefaFormModal) precisa listar
-- TODOS os clientes ativos para qualquer usuário autorizado a operar o CRM,
-- inclusive consultor_comercial — que normalmente só enxerga os clientes
-- atribuídos a ele (RLS scope policy de 20260423160000).
--
-- Decisão (fundador, aprovada por seguranca): expor uma projeção mínima
-- (id, name, razao_social) é seguro — não vaza colunas sensíveis (financeiro,
-- assigned_*, status interno, contracted_products, etc). Manter a policy SELECT
-- estrita evita regressão; a RPC SECURITY DEFINER abre apenas a porta
-- necessária e auditável.
--
-- Roles permitidas: usuários autenticados que tenham qualquer role do CRM/ops.
-- Mantemos um filtro defensivo via has_role para evitar uso fora de contexto.
--
-- Reverter: DROP FUNCTION public.list_active_clients_minimal();

CREATE OR REPLACE FUNCTION public.list_active_clients_minimal()
RETURNS TABLE (
  id uuid,
  name text,
  razao_social text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Gate de autorização: precisa de role operacional. Bloqueia usuários
  -- autenticados sem nenhum papel (defesa em profundidade).
  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'ceo'::user_role)
    OR public.has_role(auth.uid(), 'consultor_comercial'::user_role)
    OR public.has_role(auth.uid(), 'gestor_projetos'::user_role)
    OR public.has_role(auth.uid(), 'gestor_ads'::user_role)
    OR public.has_role(auth.uid(), 'sucesso_cliente'::user_role)
    OR public.has_role(auth.uid(), 'financeiro'::user_role)
    OR public.has_role(auth.uid(), 'outbound'::user_role)
  ) THEN
    RAISE EXCEPTION 'forbidden: role not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c.id, c.name, c.razao_social
  FROM public.clients c
  WHERE c.archived = false
  ORDER BY c.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_active_clients_minimal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_clients_minimal() TO authenticated;

COMMENT ON FUNCTION public.list_active_clients_minimal() IS
  'Projeção mínima (id, name, razao_social) de clientes ativos para uso em comboboxes operacionais (ex: CRM Gerar Tarefa). SECURITY DEFINER bypassa RLS de clients intencionalmente — colunas sensíveis NÃO retornadas. Gate por has_role.';
