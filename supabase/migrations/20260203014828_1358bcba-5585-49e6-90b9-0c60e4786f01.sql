-- Adicionar campo para hierarquia de categorias (categoria pai)
ALTER TABLE public.product_categories
ADD COLUMN parent_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- Atualizar Millennials Growth para ficar dentro de Terceirização
UPDATE public.product_categories
SET parent_category_id = (SELECT id FROM public.product_categories WHERE slug = 'terceirizacao')
WHERE slug = 'millennials-growth';

-- Atualizar posição do Millennials Growth para ser a primeira subcategoria
UPDATE public.product_categories
SET position = 0
WHERE slug = 'millennials-growth';

-- Atualizar posição da Terceirização para ser a primeira categoria principal
UPDATE public.product_categories
SET position = 0
WHERE slug = 'terceirizacao';

-- Reordenar outras categorias principais
UPDATE public.product_categories SET position = 1 WHERE slug = 'marketplace';
UPDATE public.product_categories SET position = 2 WHERE slug = 'comunidade';
UPDATE public.product_categories SET position = 3 WHERE slug = 'educacional';
UPDATE public.product_categories SET position = 4 WHERE slug = 'saas';