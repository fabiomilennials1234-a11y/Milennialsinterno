-- RLS BACKUP: public.clients policies ANTES da reorientação Slice 2 (#78 / ADR 0005)
-- Gerado em: 2026-06-03T14:47:45Z. Restaura o estado pré-colapso.

-- public.clients [INSERT]
CREATE POLICY "Admin can create clients" ON public.clients
  FOR INSERT TO public
  WITH CHECK (is_admin(auth.uid()));

-- public.clients [UPDATE]
CREATE POLICY "Admin can update clients" ON public.clients
  FOR UPDATE TO public
  USING (is_admin(auth.uid()))
;

-- public.clients [UPDATE]
CREATE POLICY "Ads Manager can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (((is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role)) AND (assigned_ads_manager = auth.uid())))
  WITH CHECK (((is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role)) AND (assigned_ads_manager = auth.uid())));

-- public.clients [UPDATE]
CREATE POLICY "Consultor Comercial can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'consultor_comercial'::user_role) AND (assigned_comercial = auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'consultor_comercial'::user_role) AND (assigned_comercial = auth.uid())));

-- public.clients [UPDATE]
CREATE POLICY "Consultor MKT Place can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'consultor_mktplace'::user_role) AND (assigned_mktplace = (auth.uid())::text)))
  WITH CHECK ((has_role(auth.uid(), 'consultor_mktplace'::user_role) AND (assigned_mktplace = (auth.uid())::text)));

-- public.clients [UPDATE]
CREATE POLICY "Financeiro can update clients for churn workflow" ON public.clients
  FOR UPDATE TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role)))
;

-- public.clients [UPDATE]
CREATE POLICY "Gestor CRM can update assigned clients" ON public.clients
  FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'gestor_crm'::user_role) AND (assigned_crm = auth.uid())))
  WITH CHECK ((has_role(auth.uid(), 'gestor_crm'::user_role) AND (assigned_crm = auth.uid())));

-- public.clients [UPDATE]
CREATE POLICY "Sucesso do Cliente can update clients for CX validation" ON public.clients
  FOR UPDATE TO authenticated
  USING ((is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)))
  WITH CHECK ((is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role)));

-- public.clients [SELECT]
CREATE POLICY clients_select_visao_total ON public.clients
  FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) OR (has_role(auth.uid(), 'gestor_projetos'::user_role) AND (group_id = get_user_group_id(auth.uid()))) OR (assigned_ads_manager = auth.uid()) OR (assigned_comercial = auth.uid()) OR (assigned_crm = auth.uid()) OR (assigned_rh = auth.uid()) OR (assigned_outbound_manager = auth.uid()) OR (assigned_sucesso_cliente = auth.uid()) OR (assigned_mktplace = (auth.uid())::text) OR can_access_page_data(auth.uid(), 'cliente-list'::text) OR can_access_page_data(auth.uid(), 'gestor-ads'::text) OR can_access_page_data(auth.uid(), 'consultor-comercial'::text) OR can_access_page_data(auth.uid(), 'gestor-crm'::text) OR can_access_page_data(auth.uid(), 'outbound'::text) OR can_access_page_data(auth.uid(), 'sucesso-cliente'::text) OR can_access_page_data(auth.uid(), 'financeiro'::text) OR can_access_page_data(auth.uid(), 'consultor-mktplace'::text)))
;

-- public.clients [SELECT]
CREATE POLICY secondary_manager_can_view_client ON public.clients
  FOR SELECT TO authenticated
  USING ((id IN ( SELECT client_secondary_managers.client_id
   FROM client_secondary_managers
  WHERE (client_secondary_managers.secondary_manager_id = auth.uid()))))
;

