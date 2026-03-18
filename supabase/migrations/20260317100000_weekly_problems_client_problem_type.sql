-- Add 'client_problem' to the problem_type CHECK constraint on weekly_problems
ALTER TABLE public.weekly_problems DROP CONSTRAINT IF EXISTS weekly_problems_problem_type_check;
ALTER TABLE public.weekly_problems ADD CONSTRAINT weekly_problems_problem_type_check
  CHECK (problem_type IN ('challenge', 'delay_video', 'delay_design', 'delay_site', 'delay_crm', 'delay_automation', 'observation', 'client_problem'));

-- Allow all authenticated users to insert weekly problems (meetings create them automatically)
CREATE POLICY "Autenticados podem criar problemas semanais"
  ON public.weekly_problems FOR INSERT TO authenticated WITH CHECK (true);
