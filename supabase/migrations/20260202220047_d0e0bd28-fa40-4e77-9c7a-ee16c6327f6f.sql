-- Criar tabela de categorias de produtos (diferentes de independent_categories)
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Política: somente CEO pode ver
CREATE POLICY "CEO can view all product categories"
ON public.product_categories
FOR SELECT
USING (public.is_ceo(auth.uid()));

-- Política: somente CEO pode gerenciar
CREATE POLICY "CEO can manage product categories"
ON public.product_categories
FOR ALL
USING (public.is_ceo(auth.uid()))
WITH CHECK (public.is_ceo(auth.uid()));

-- Adicionar coluna em organization_groups para vincular a product_category
ALTER TABLE public.organization_groups
ADD COLUMN product_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- Inserir as categorias de produtos
INSERT INTO public.product_categories (name, slug, icon, position) VALUES
  ('Millennials Growth', 'millennials-growth', 'TrendingUp', 0),
  ('Marketplace', 'marketplace', 'ShoppingCart', 1),
  ('Comunidade', 'comunidade', 'Users', 2),
  ('Educacional', 'educacional', 'GraduationCap', 3),
  ('Terceirização', 'terceirizacao', 'Building', 4),
  ('SAAS', 'saas', 'Cloud', 5);

-- Vincular os grupos existentes à categoria "Millennials Growth"
UPDATE public.organization_groups
SET product_category_id = (SELECT id FROM public.product_categories WHERE slug = 'millennials-growth')
WHERE product_category_id IS NULL;