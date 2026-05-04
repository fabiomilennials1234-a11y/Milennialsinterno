-- 20260504220000_client_secondary_managers.sql
--
-- Tabela para gestor secundário de ADS por cliente.
-- Um cliente pode ter no máximo 1 gestor secundário (UNIQUE client_id).
-- RLS: apenas admins gerenciam; gestor secundário vê próprio registro.
-- Política adicional em public.clients permite gestor secundário ver o cliente associado.

BEGIN;

CREATE TABLE public.client_secondary_managers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  secondary_manager_id UUID        NOT NULL REFERENCES auth.users(id),
  phase                TEXT        NOT NULL CHECK (phase IN ('onboarding', 'acompanhamento')),
  created_by           UUID        NOT NULL REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Índices para FK usadas em policies e joins frequentes
CREATE INDEX idx_csm_secondary_manager ON public.client_secondary_managers(secondary_manager_id);
CREATE INDEX idx_csm_client            ON public.client_secondary_managers(client_id);

ALTER TABLE public.client_secondary_managers ENABLE ROW LEVEL SECURITY;

-- SELECT: gestor secundário vê próprio registro; admin vê todos
CREATE POLICY "csm_select" ON public.client_secondary_managers
  FOR SELECT TO authenticated
  USING (
    secondary_manager_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- INSERT/UPDATE/DELETE: somente admin
CREATE POLICY "csm_admin_insert" ON public.client_secondary_managers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "csm_admin_update" ON public.client_secondary_managers
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "csm_admin_delete" ON public.client_secondary_managers
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Trigger updated_at via moddatetime (extensão já instalada no projeto)
CREATE TRIGGER csm_moddatetime
  BEFORE UPDATE ON public.client_secondary_managers
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

-- Policy adicional em clients: gestor secundário pode ver o cliente ao qual foi atribuído.
-- As policies SELECT do PostgreSQL são OR-combinadas, então esta complementa
-- a clients_select_visao_total existente sem conflito.
CREATE POLICY "secondary_manager_can_view_client" ON public.clients
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT client_id
      FROM public.client_secondary_managers
      WHERE secondary_manager_id = auth.uid()
    )
  );

COMMIT;
