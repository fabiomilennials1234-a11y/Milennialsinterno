-- Corrigir políticas permissivas para INSERT e DELETE em notificações
DROP POLICY IF EXISTS "Sistema pode inserir notificações" ON public.ads_task_delay_notifications;
DROP POLICY IF EXISTS "Sistema pode deletar notificações" ON public.ads_task_delay_notifications;

-- Nova política para INSERT - apenas usuários autenticados com cargo adequado
CREATE POLICY "Usuários autenticados podem inserir notificações" 
ON public.ads_task_delay_notifications 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('gestor_ads', 'sucesso_cliente', 'gestor_projetos', 'ceo')
  )
);

-- Nova política para DELETE - apenas admins
CREATE POLICY "Admins podem deletar notificações" 
ON public.ads_task_delay_notifications 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('ceo', 'gestor_projetos')
  )
);