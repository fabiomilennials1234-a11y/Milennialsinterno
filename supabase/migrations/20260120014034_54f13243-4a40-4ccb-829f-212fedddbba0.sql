
-- Adicionar policy para permitir que admin possa gerenciar todo o tracking
CREATE POLICY "Admin can manage all tracking" 
ON public.client_daily_tracking 
FOR ALL
USING (is_admin(auth.uid()));
