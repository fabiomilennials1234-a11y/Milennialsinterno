-- =============================================================================
-- Backup RLS policies pre-RC4 fix — 2026-04-23
-- Projeto: Milennials interno (semhnpwxptfgqxhkoqsk, PROD)
-- Tabelas: kanban_boards, kanban_cards, kanban_columns, clients
--
-- Objetivo: snapshot reconstruivel caso precise reverter fase 1/2.
-- Dump extraido de pg_policies via live query (supabase db query --linked).
--
-- Contagem live pre-fix (board comercial):
--   board_id = 20b02eb7-b538-4921-b6e9-152fad61ad8d
--   total cards = 114
--   breakdown por grupo do client:
--     - grupo-1- ....... 70 cards
--     - grupo-2- ....... 27 cards
--     - <client deletado> . 11 cards (orfaos, FK dangling)
--     - <client_id NULL>   6 cards (orfaos, sem client)
--
-- Maycon (consultor_comercial, grupo-2-):
--   user_id = 3fe3996b-f90d-4594-9cc4-1fd87ea19d2d
--   group_id = cc3cbc60-e71c-4c60-bfee-720657a98e6c
--   Post-fix esperado: 27 cards visiveis.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- kanban_boards
-- -----------------------------------------------------------------------------

CREATE POLICY "Admins can create boards"
  ON public.kanban_boards
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete boards"
  ON public.kanban_boards
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update boards"
  ON public.kanban_boards
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

-- RC4: POLICY PERMISSIVA QUE VAZA DADOS — SERA DROPADA NA FASE 1
CREATE POLICY "Authenticated users can view boards"
  ON public.kanban_boards
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view their boards"
  ON public.kanban_boards
  FOR SELECT
  TO authenticated
  USING (can_view_board(auth.uid(), id));

-- -----------------------------------------------------------------------------
-- kanban_cards
-- -----------------------------------------------------------------------------

CREATE POLICY "Authenticated users can create cards"
  ON public.kanban_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- RC4: POLICY PERMISSIVA QUE VAZA DADOS — SERA DROPADA NA FASE 1
CREATE POLICY "Authenticated users can view cards"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Design roles can delete cards"
  ON public.kanban_cards
  FOR DELETE
  TO public
  USING (
    is_admin(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role])
    )
  );

CREATE POLICY "Design roles can update cards"
  ON public.kanban_cards
  FOR UPDATE
  TO public
  USING (
    is_admin(auth.uid())
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY['ceo'::user_role, 'gestor_projetos'::user_role, 'gestor_ads'::user_role, 'design'::user_role])
    )
  );

CREATE POLICY "Users can delete cards in their boards"
  ON public.kanban_cards
  FOR DELETE
  TO authenticated
  USING (can_view_board(auth.uid(), board_id));

CREATE POLICY "Users can insert cards in their boards"
  ON public.kanban_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (can_view_board(auth.uid(), board_id));

CREATE POLICY "Users can update cards in their boards"
  ON public.kanban_cards
  FOR UPDATE
  TO authenticated
  USING (can_view_board(auth.uid(), board_id));

CREATE POLICY "Users can view cards in their boards"
  ON public.kanban_cards
  FOR SELECT
  TO authenticated
  USING (can_view_board(auth.uid(), board_id));

-- -----------------------------------------------------------------------------
-- kanban_columns
-- -----------------------------------------------------------------------------

CREATE POLICY "Admins can manage columns"
  ON public.kanban_columns
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- RC4: POLICY PERMISSIVA QUE VAZA DADOS — SERA DROPADA NA FASE 1
CREATE POLICY "Authenticated users can view columns"
  ON public.kanban_columns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view columns in their boards"
  ON public.kanban_columns
  FOR SELECT
  TO authenticated
  USING (can_view_board(auth.uid(), board_id));

-- -----------------------------------------------------------------------------
-- clients (nao sera modificada, incluido apenas para snapshot completo)
-- -----------------------------------------------------------------------------

CREATE POLICY "Admin can create clients"
  ON public.clients
  FOR INSERT
  TO public
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can update clients"
  ON public.clients
  FOR UPDATE
  TO public
  USING (is_admin(auth.uid()));

CREATE POLICY "Ads Manager can update assigned clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role))
    AND assigned_ads_manager = auth.uid()
  )
  WITH CHECK (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_ads'::user_role))
    AND assigned_ads_manager = auth.uid()
  );

CREATE POLICY "Ads Manager can view assigned clients"
  ON public.clients
  FOR SELECT
  TO public
  USING (assigned_ads_manager = auth.uid());

CREATE POLICY "CEO can view all clients"
  ON public.clients
  FOR SELECT
  TO public
  USING (is_ceo(auth.uid()));

CREATE POLICY "Consultor Comercial can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'consultor_comercial'::user_role));

CREATE POLICY "Financeiro can update clients for churn workflow"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role));

CREATE POLICY "Financeiro can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'financeiro'::user_role));

CREATE POLICY "Gestor de Projetos can view clients in their group"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (has_role(auth.uid(), 'gestor_projetos'::user_role) AND group_id = get_user_group_id(auth.uid()))
  );

CREATE POLICY "Outbound can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'outbound'::user_role));

CREATE POLICY "Sucesso do Cliente can update clients for CX validation"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role));

CREATE POLICY "Sucesso do Cliente can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'sucesso_cliente'::user_role));

-- =============================================================================
-- FIM DO BACKUP
-- =============================================================================
