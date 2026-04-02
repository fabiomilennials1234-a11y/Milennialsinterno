-- Add CX validation fields to clients table
-- cx_validation_status: 'aguardando_validacao' | 'pendente_aprovacao' | 'validado'
-- aguardando_validacao = novo cliente, popup do CX ainda não respondido
-- pendente_aprovacao = CX marcou "Não", aguardando aprovação manual
-- validado = CX aprovou (via popup ou via botão Aprovar)

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS cx_validation_status TEXT DEFAULT 'aguardando_validacao',
ADD COLUMN IF NOT EXISTS cx_validation_notes TEXT,
ADD COLUMN IF NOT EXISTS cx_validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cx_validated_by UUID;

-- Set existing clients as already validated (only new clients need validation)
UPDATE public.clients
SET cx_validation_status = 'validado'
WHERE created_at < '2026-04-02T00:00:00Z';
