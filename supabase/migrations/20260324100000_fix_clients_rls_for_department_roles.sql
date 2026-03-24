-- =============================================
-- FIX: Adicionar políticas SELECT na tabela clients para cargos departamentais
-- =============================================
-- PROBLEMA: A tabela `clients` só tinha políticas SELECT para:
--   - CEO (todos os clientes)
--   - Gestor de Projetos (clientes do mesmo grupo)
--   - Ads Manager (clientes atribuídos)
--
-- Os cargos financeiro, sucesso_cliente, consultor_comercial e outbound NÃO tinham
-- acesso SELECT, causando:
--   - useFinanceiroActiveClients() retornava 0 (JOIN com clients retornava null)
--   - Dashboard Financeiro mostrava R$ 0 e 0 clientes
--   - Sucesso do Cliente, Comercial e Outbound também não viam clientes
--
-- CORREÇÃO: Adicionar política SELECT para cada cargo que precisa ver clientes.
-- Todos veem TODOS os clientes (mesma base de dados do CEO), pois o recorte
-- de permissão é feito no nível da aplicação (páginas/componentes), não no banco.

-- 1. Financeiro pode ver todos os clientes (precisa para gestão de contratos)
CREATE POLICY "Financeiro can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'financeiro')
  );

-- 2. Sucesso do Cliente pode ver todos os clientes (precisa para gestão de sucesso)
CREATE POLICY "Sucesso do Cliente can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'sucesso_cliente')
  );

-- 3. Consultor Comercial pode ver todos os clientes (precisa para vendas e churn)
CREATE POLICY "Consultor Comercial can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'consultor_comercial')
  );

-- 4. Outbound pode ver todos os clientes (precisa para gestão de prospecção)
CREATE POLICY "Outbound can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'outbound')
  );

-- 5. Financeiro pode atualizar clientes (necessário para fluxo de churn/distrato)
-- O hook useMarkClientAsChurn e moveToChurn atualizam status e distrato_step
CREATE POLICY "Financeiro can update clients for churn workflow"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'financeiro')
  );

-- 6. Corrigir política SELECT da financeiro_active_clients para usar TO authenticated
-- A política original usava USING(true) sem TO, o que pode não funcionar
-- corretamente em todas as configurações do Supabase/PostgREST.
DROP POLICY IF EXISTS "Anyone can view active clients" ON public.financeiro_active_clients;
CREATE POLICY "Anyone can view active clients"
  ON public.financeiro_active_clients
  FOR SELECT
  TO authenticated
  USING (true);
