-- ============================================
-- DESIGN KANBAN: Tables and configuration
-- ============================================

-- 1. Create design_briefings table for Design card briefings
CREATE TABLE public.design_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  description TEXT, -- Descrição das artes
  references_url TEXT, -- Referências (link)
  identity_url TEXT, -- Identidade visual do cliente (link)
  client_instagram TEXT, -- @ do cliente no Instagram
  script_url TEXT, -- Roteiro para as artes (link)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(card_id) -- One briefing per card
);

-- 2. Create card_attachments table for file attachments
CREATE TABLE public.card_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- image/png, image/jpeg, etc.
  file_size INTEGER, -- size in bytes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- 3. Create storage bucket for card attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('card-attachments', 'card-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS on new tables
ALTER TABLE public.design_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_attachments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for design_briefings
CREATE POLICY "design_briefings_select" 
ON public.design_briefings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "design_briefings_insert" 
ON public.design_briefings 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

CREATE POLICY "design_briefings_update" 
ON public.design_briefings 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

CREATE POLICY "design_briefings_delete" 
ON public.design_briefings 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

-- 6. RLS Policies for card_attachments
CREATE POLICY "card_attachments_select" 
ON public.card_attachments 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "card_attachments_insert" 
ON public.card_attachments 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

CREATE POLICY "card_attachments_delete" 
ON public.card_attachments 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

-- 7. Storage policies for card-attachments bucket
CREATE POLICY "card_attachments_storage_select" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'card-attachments');

CREATE POLICY "card_attachments_storage_insert" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

CREATE POLICY "card_attachments_storage_delete" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'card-attachments' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('ceo', 'gestor_projetos', 'gestor_ads', 'design')
  )
);

-- 8. Create trigger for design_briefings updated_at
CREATE OR REPLACE FUNCTION public.update_design_briefings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_design_briefings_updated_at
  BEFORE UPDATE ON public.design_briefings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_design_briefings_updated_at();

-- 9. Enable realtime for newly created tables ONLY
ALTER PUBLICATION supabase_realtime ADD TABLE public.design_briefings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_attachments;