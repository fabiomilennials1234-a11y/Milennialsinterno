-- Allow public access to read exit reasons by token (for the public form page)
CREATE POLICY "Public can read by token"
ON public.cs_exit_reasons
FOR SELECT
USING (public_token IS NOT NULL);