-- Cat 8 Item 3: Add 3 new optional fields to results reports
-- Fields: vendas_novos_clientes, ticket_medio_novos, valor_vendas_novos

ALTER TABLE public.client_results_reports
  ADD COLUMN IF NOT EXISTS vendas_novos_clientes text,
  ADD COLUMN IF NOT EXISTS ticket_medio_novos text,
  ADD COLUMN IF NOT EXISTS valor_vendas_novos text;
