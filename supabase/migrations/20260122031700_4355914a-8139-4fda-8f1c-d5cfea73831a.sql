-- Criar tabela de notas do cliente (compartilhadas entre Gestor de Tráfego e Consultor Comercial)
CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'note', -- 'note' para notas do gestor, 'comment' para comentários do comercial
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Gestor de Ads pode criar/editar notas em clientes atribuídos a ele
CREATE POLICY "Gestor de Ads pode criar notas" 
ON public.client_notes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_notes.client_id 
    AND (
      clients.assigned_ads_manager = auth.uid()
      OR public.is_ceo(auth.uid())
      OR public.has_role(auth.uid(), 'gestor_projetos')
    )
  )
);

-- Policy: Gestor de Ads pode atualizar apenas suas próprias notas (não comentários)
CREATE POLICY "Gestor de Ads pode editar suas notas" 
ON public.client_notes 
FOR UPDATE 
USING (
  created_by = auth.uid() 
  AND note_type = 'note'
);

-- Policy: Gestor de Ads pode deletar apenas suas próprias notas
CREATE POLICY "Gestor de Ads pode deletar suas notas" 
ON public.client_notes 
FOR DELETE 
USING (
  created_by = auth.uid() 
  AND note_type = 'note'
);

-- Policy: Consultor Comercial pode criar comentários em clientes atribuídos a ele
CREATE POLICY "Consultor Comercial pode criar comentarios" 
ON public.client_notes 
FOR INSERT 
WITH CHECK (
  note_type = 'comment'
  AND EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_notes.client_id 
    AND (
      clients.assigned_comercial = auth.uid()
      OR public.is_ceo(auth.uid())
      OR public.has_role(auth.uid(), 'gestor_projetos')
    )
  )
);

-- Policy: Todos os envolvidos podem visualizar notas
CREATE POLICY "Envolvidos podem visualizar notas" 
ON public.client_notes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_notes.client_id 
    AND (
      clients.assigned_ads_manager = auth.uid()
      OR clients.assigned_comercial = auth.uid()
      OR public.is_ceo(auth.uid())
      OR public.has_role(auth.uid(), 'gestor_projetos')
      OR public.has_role(auth.uid(), 'sucesso_cliente')
    )
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_notes;

-- Trigger para updated_at
CREATE TRIGGER update_client_notes_updated_at
BEFORE UPDATE ON public.client_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_client_notes_client_id ON public.client_notes(client_id);
CREATE INDEX idx_client_notes_created_by ON public.client_notes(created_by);
CREATE INDEX idx_client_notes_note_type ON public.client_notes(note_type);