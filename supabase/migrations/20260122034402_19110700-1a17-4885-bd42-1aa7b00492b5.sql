-- Create financeiro onboarding table to track client contract status
CREATE TABLE public.financeiro_client_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_step TEXT NOT NULL DEFAULT 'novo_cliente',
  -- Steps: novo_cliente -> cadastro_asaas -> contrato_juridico -> contrato_enviado -> esperando_assinatura -> contrato_assinado
  step_cadastro_asaas_at TIMESTAMP WITH TIME ZONE,
  step_contrato_juridico_at TIMESTAMP WITH TIME ZONE,
  step_contrato_enviado_at TIMESTAMP WITH TIME ZONE,
  step_esperando_assinatura_at TIMESTAMP WITH TIME ZONE,
  step_contrato_assinado_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financeiro_client_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS policies for Financeiro, Gestor de Projetos, and CEO
CREATE POLICY "Financeiro can view all onboarding records"
  ON public.financeiro_client_onboarding FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.id IN (
        SELECT ur.id FROM public.profiles ur
        JOIN public.user_roles ON user_roles.user_id = ur.user_id
        WHERE user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
      )
    )
  );

CREATE POLICY "Financeiro can insert onboarding records"
  ON public.financeiro_client_onboarding FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.id IN (
        SELECT ur.id FROM public.profiles ur
        JOIN public.user_roles ON user_roles.user_id = ur.user_id
        WHERE user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
      )
    )
  );

CREATE POLICY "Financeiro can update onboarding records"
  ON public.financeiro_client_onboarding FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.id IN (
        SELECT ur.id FROM public.profiles ur
        JOIN public.user_roles ON user_roles.user_id = ur.user_id
        WHERE user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
      )
    )
  );

CREATE POLICY "Financeiro can delete onboarding records"
  ON public.financeiro_client_onboarding FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.id IN (
        SELECT ur.id FROM public.profiles ur
        JOIN public.user_roles ON user_roles.user_id = ur.user_id
        WHERE user_roles.role IN ('financeiro', 'gestor_projetos', 'ceo')
      )
    )
  );

-- Create trigger for automatic onboarding record creation when client is created
CREATE OR REPLACE FUNCTION public.create_financeiro_onboarding_on_client_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financeiro_client_onboarding (client_id, current_step)
  VALUES (NEW.id, 'novo_cliente')
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_financeiro_onboarding
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_financeiro_onboarding_on_client_insert();

-- Create onboarding records for existing clients
INSERT INTO public.financeiro_client_onboarding (client_id, current_step)
SELECT id, 'novo_cliente' FROM public.clients
WHERE archived = false
ON CONFLICT (client_id) DO NOTHING;

-- Enable realtime for financeiro onboarding
ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_client_onboarding;