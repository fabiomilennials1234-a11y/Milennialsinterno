-- 1. Criar categoria pai "Eventos"
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
VALUES ('Eventos', 'eventos', '📅', 6, NULL);

-- 2. Inserir subcategorias em Terceirização
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Millennials Outbound', 'millennials-outbound', '📞', 2, id FROM public.product_categories WHERE slug = 'terceirizacao' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'ON Demand', 'on-demand', '⚡', 3, id FROM public.product_categories WHERE slug = 'terceirizacao' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Catalog', 'catalog-terceirizacao', '📚', 4, id FROM public.product_categories WHERE slug = 'terceirizacao' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

-- 3. Inserir subcategorias em Marketplace
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Zydon', 'zydon', '🛒', 1, id FROM public.product_categories WHERE slug = 'marketplace' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Septem', 'septem', '🏪', 2, id FROM public.product_categories WHERE slug = 'marketplace' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

-- 4. Inserir subcategorias em Comunidade
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Vendedor Pastinha', 'vendedor-pastinha-comunidade', '👔', 1, id FROM public.product_categories WHERE slug = 'comunidade' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'B2B Club', 'b2b-club', '🤝', 2, id FROM public.product_categories WHERE slug = 'comunidade' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

-- 5. Inserir subcategorias em Educacional
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Forja', 'forja', '🔨', 1, id FROM public.product_categories WHERE slug = 'educacional' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Millennials Paddock', 'millennials-paddock', '🏎️', 2, id FROM public.product_categories WHERE slug = 'educacional' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Vendedor Pastinha', 'vendedor-pastinha-educacional', '📖', 3, id FROM public.product_categories WHERE slug = 'educacional' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

-- 6. Inserir subcategorias em SAAS
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Torque CRM', 'torque-crm', '🔧', 1, id FROM public.product_categories WHERE slug = 'saas' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Millennials Hunting', 'millennials-hunting', '🎯', 2, id FROM public.product_categories WHERE slug = 'saas' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Organic', 'organic', '🌱', 3, id FROM public.product_categories WHERE slug = 'saas' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'Catalog', 'catalog-saas', '📋', 4, id FROM public.product_categories WHERE slug = 'saas' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;

-- 7. Inserir subcategoria em Eventos
INSERT INTO public.product_categories (name, slug, icon, position, parent_category_id)
SELECT 'B2B Summit', 'b2b-summit', '🎪', 1, id FROM public.product_categories WHERE slug = 'eventos' AND parent_category_id IS NULL
ON CONFLICT DO NOTHING;