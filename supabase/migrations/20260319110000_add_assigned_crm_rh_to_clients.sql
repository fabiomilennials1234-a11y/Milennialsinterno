-- Adicionar campos de responsáveis CRM e RH na tabela clients
-- Torque CRM → Gestor de CRM
-- Millennials Hunting → RH

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assigned_crm UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_rh UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_assigned_crm ON public.clients(assigned_crm);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_rh ON public.clients(assigned_rh);
