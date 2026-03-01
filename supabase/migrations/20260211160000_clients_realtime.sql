-- Habilitar Realtime na tabela clients para que gestores de ads recebam
-- atualização em tempo real quando novos clientes forem atribuídos a eles.
-- Resolve o problema de clientes não aparecerem até recarregar a página.

-- REPLICA IDENTITY FULL é necessário para filtros em subscriptions Realtime
ALTER TABLE public.clients REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
