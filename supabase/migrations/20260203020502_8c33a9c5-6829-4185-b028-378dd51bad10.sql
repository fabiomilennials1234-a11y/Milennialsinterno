
-- 1. Adicionar coluna product_category_id em kanban_boards se não existir
ALTER TABLE public.kanban_boards 
ADD COLUMN IF NOT EXISTS product_category_id UUID REFERENCES public.product_categories(id);

-- 2. Criar kanban boards para cada produto (NÃO INCLUI MILLENNIALS GROWTH)

-- Terceirização - Millennials Outbound
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Millennials Outbound', 'millennials-outbound', 'Kanban do produto Millennials Outbound', id
FROM public.product_categories WHERE slug = 'millennials-outbound'
ON CONFLICT DO NOTHING;

-- Terceirização - ON Demand
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'ON Demand', 'on-demand', 'Kanban do produto ON Demand', id
FROM public.product_categories WHERE slug = 'on-demand'
ON CONFLICT DO NOTHING;

-- Terceirização - Catalog
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Catalog', 'catalog-terceirizacao', 'Kanban do produto Catalog (Terceirização)', id
FROM public.product_categories WHERE slug = 'catalog-terceirizacao'
ON CONFLICT DO NOTHING;

-- Marketplace - Zydon
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Zydon', 'zydon', 'Kanban do produto Zydon', id
FROM public.product_categories WHERE slug = 'zydon'
ON CONFLICT DO NOTHING;

-- Marketplace - Septem
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Septem', 'septem', 'Kanban do produto Septem', id
FROM public.product_categories WHERE slug = 'septem'
ON CONFLICT DO NOTHING;

-- Comunidade - Vendedor Pastinha
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Vendedor Pastinha', 'vendedor-pastinha-comunidade', 'Kanban do produto Vendedor Pastinha (Comunidade)', id
FROM public.product_categories WHERE slug = 'vendedor-pastinha-comunidade'
ON CONFLICT DO NOTHING;

-- Comunidade - B2B Club
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'B2B Club', 'b2b-club', 'Kanban do produto B2B Club', id
FROM public.product_categories WHERE slug = 'b2b-club'
ON CONFLICT DO NOTHING;

-- Educacional - Forja
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Forja', 'forja', 'Kanban do produto Forja', id
FROM public.product_categories WHERE slug = 'forja'
ON CONFLICT DO NOTHING;

-- Educacional - Millennials Paddock
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Millennials Paddock', 'millennials-paddock', 'Kanban do produto Millennials Paddock', id
FROM public.product_categories WHERE slug = 'millennials-paddock'
ON CONFLICT DO NOTHING;

-- Educacional - Vendedor Pastinha
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Vendedor Pastinha', 'vendedor-pastinha-educacional', 'Kanban do produto Vendedor Pastinha (Educacional)', id
FROM public.product_categories WHERE slug = 'vendedor-pastinha-educacional'
ON CONFLICT DO NOTHING;

-- SAAS - Torque CRM
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Torque CRM', 'torque-crm', 'Kanban do produto Torque CRM', id
FROM public.product_categories WHERE slug = 'torque-crm'
ON CONFLICT DO NOTHING;

-- SAAS - Millennials Hunting
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Millennials Hunting', 'millennials-hunting', 'Kanban do produto Millennials Hunting', id
FROM public.product_categories WHERE slug = 'millennials-hunting'
ON CONFLICT DO NOTHING;

-- SAAS - Organic
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Organic', 'organic', 'Kanban do produto Organic', id
FROM public.product_categories WHERE slug = 'organic'
ON CONFLICT DO NOTHING;

-- SAAS - Catalog
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'Catalog', 'catalog-saas', 'Kanban do produto Catalog (SAAS)', id
FROM public.product_categories WHERE slug = 'catalog-saas'
ON CONFLICT DO NOTHING;

-- Eventos - B2B Summit
INSERT INTO public.kanban_boards (name, slug, description, product_category_id)
SELECT 'B2B Summit', 'b2b-summit', 'Kanban do produto B2B Summit', id
FROM public.product_categories WHERE slug = 'b2b-summit'
ON CONFLICT DO NOTHING;

-- 3. Criar coluna "NOVO CLIENTE" para cada board criado
INSERT INTO public.kanban_columns (board_id, title, position)
SELECT kb.id, 'NOVO CLIENTE', 0
FROM public.kanban_boards kb
WHERE kb.slug IN (
  'millennials-outbound', 'on-demand', 'catalog-terceirizacao',
  'zydon', 'septem',
  'vendedor-pastinha-comunidade', 'b2b-club',
  'forja', 'millennials-paddock', 'vendedor-pastinha-educacional',
  'torque-crm', 'millennials-hunting', 'organic', 'catalog-saas',
  'b2b-summit'
)
ON CONFLICT DO NOTHING;
