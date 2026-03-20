-- Tabela de perfis de acesso customizados
-- Permite criar perfis com nome e páginas de acesso selecionadas
-- que ficam disponíveis como opções reutilizáveis ao criar novos usuários

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  allowed_pages TEXT[] DEFAULT '{}',
  is_viewer BOOLEAN DEFAULT false,
  squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Se a tabela já existe mas falta as colunas novas, adiciona
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_roles' AND column_name = 'is_viewer') THEN
    ALTER TABLE public.custom_roles ADD COLUMN is_viewer BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custom_roles' AND column_name = 'squad_id') THEN
    ALTER TABLE public.custom_roles ADD COLUMN squad_id UUID REFERENCES public.squads(id) ON DELETE SET NULL;
  END IF;
END$$;

-- RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

-- Todos podem ler (para popular o select no modal)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'custom_roles_select') THEN
    CREATE POLICY "custom_roles_select" ON public.custom_roles FOR SELECT USING (true);
  END IF;
END $$;

-- Apenas CEO pode inserir/atualizar/deletar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'custom_roles_insert') THEN
    CREATE POLICY "custom_roles_insert" ON public.custom_roles FOR INSERT WITH CHECK (public.is_ceo(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'custom_roles_update') THEN
    CREATE POLICY "custom_roles_update" ON public.custom_roles FOR UPDATE USING (public.is_ceo(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'custom_roles_delete') THEN
    CREATE POLICY "custom_roles_delete" ON public.custom_roles FOR DELETE USING (public.is_ceo(auth.uid()));
  END IF;
END $$;
