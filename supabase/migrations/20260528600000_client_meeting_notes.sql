-- Meeting notes per client
-- Each note captures a meeting summary with title, content, and meeting date.

CREATE TABLE public.client_meeting_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_client_meeting_notes_client ON public.client_meeting_notes(client_id);
CREATE INDEX idx_client_meeting_notes_date ON public.client_meeting_notes(client_id, meeting_date DESC);

-- RLS
ALTER TABLE public.client_meeting_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: admin OR assigned to client (ads_manager, comercial, mktplace, sucesso_cliente, gestor_projetos)
CREATE POLICY "meeting_notes_select" ON public.client_meeting_notes
FOR SELECT USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'gestor_projetos')
  OR public.has_role(auth.uid(), 'sucesso_cliente')
  OR EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = client_meeting_notes.client_id
    AND (
      c.assigned_ads_manager = auth.uid()
      OR c.assigned_comercial = auth.uid()
      OR c.assigned_mktplace = auth.uid()::text
    )
  )
);

-- INSERT: must be self, and either admin/gestor_projetos or assigned to client
CREATE POLICY "meeting_notes_insert" ON public.client_meeting_notes
FOR INSERT WITH CHECK (
  client_meeting_notes.created_by = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'gestor_projetos')
    OR public.has_role(auth.uid(), 'sucesso_cliente')
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_meeting_notes.client_id
      AND (
        c.assigned_ads_manager = auth.uid()
        OR c.assigned_comercial = auth.uid()
        OR c.assigned_mktplace = auth.uid()::text
      )
    )
  )
);

-- UPDATE: admin OR own note
CREATE POLICY "meeting_notes_update" ON public.client_meeting_notes
FOR UPDATE USING (
  public.is_admin(auth.uid()) OR client_meeting_notes.created_by = auth.uid()
) WITH CHECK (
  public.is_admin(auth.uid()) OR client_meeting_notes.created_by = auth.uid()
);

-- DELETE: admin OR own note
CREATE POLICY "meeting_notes_delete" ON public.client_meeting_notes
FOR DELETE USING (
  public.is_admin(auth.uid()) OR client_meeting_notes.created_by = auth.uid()
);

-- Auto-update updated_at via moddatetime
CREATE TRIGGER set_updated_at_client_meeting_notes
  BEFORE UPDATE ON public.client_meeting_notes
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
