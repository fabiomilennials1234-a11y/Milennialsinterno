-- Habilitar Realtime para sidebar (profiles, groups, squads)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squads;
