-- Fix: app_pages.route para consultor-comercial apontava pra /kanban/comercial (board
-- legacy). UI canônica do role consultor_comercial é o hub PRO+ em /consultor-comercial
-- (decisão Opus B, migration 20260423120000 + fix routing 24e415d).
--
-- Board `comercial` continua existindo — scope de cards via RLS por client.group_id —
-- mas é acessado só por executives/gestor_projetos, não pelo consultor em si.
--
-- Seed original: 20260420170000_user_page_grants.sql

UPDATE public.app_pages
  SET route = '/consultor-comercial'
  WHERE slug = 'consultor-comercial';
