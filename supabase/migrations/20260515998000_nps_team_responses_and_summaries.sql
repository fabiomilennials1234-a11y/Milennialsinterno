-- Migration: NPS TIME + Baú de Ideias
-- Adds survey_type to nps_surveys, creates nps_team_responses for team-internal NPS,
-- and nps_team_summaries for AI-generated summaries.
-- The existing nps_responses table keeps its structure for client-facing NPS.

-- 1. Add survey_type to nps_surveys to differentiate client vs team surveys
ALTER TABLE public.nps_surveys
  ADD COLUMN IF NOT EXISTS survey_type text NOT NULL DEFAULT 'client';

-- Backfill: all existing surveys are client-type
UPDATE public.nps_surveys SET survey_type = 'client' WHERE survey_type IS NULL;

-- Add check constraint
ALTER TABLE public.nps_surveys
  ADD CONSTRAINT nps_surveys_survey_type_check
  CHECK (survey_type IN ('client', 'team'));

-- 2. Create nps_team_responses table
CREATE TABLE IF NOT EXISTS public.nps_team_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.nps_surveys(id) ON DELETE CASCADE,

  -- Q1: experience rating 1-5
  experience_rating smallint NOT NULL CHECK (experience_rating BETWEEN 1 AND 5),

  -- Q2: efficiency assessment
  efficiency_assessment text NOT NULL CHECK (efficiency_assessment IN ('sim', 'parcialmente', 'nao')),

  -- Q3: positive highlight (short text)
  positive_highlight text NOT NULL DEFAULT '',

  -- Q4: improvement suggestion (short text)
  improvement_area text NOT NULL DEFAULT '',

  -- Q5: ideas / suggestions (long text)
  ideas_suggestions text NOT NULL DEFAULT '',

  -- Metadata
  respondent_name text, -- optional, for GP identification
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Index on survey_id for FK lookups and policy filtering
CREATE INDEX IF NOT EXISTS idx_nps_team_responses_survey_id
  ON public.nps_team_responses(survey_id);

-- Index on submitted_at for ordering
CREATE INDEX IF NOT EXISTS idx_nps_team_responses_submitted_at
  ON public.nps_team_responses(submitted_at DESC);

-- RLS
ALTER TABLE public.nps_team_responses ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (public form, no auth required)
CREATE POLICY "Anyone can submit team responses"
  ON public.nps_team_responses
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admin and CS can view
CREATE POLICY "Admin and CS can view team responses"
  ON public.nps_team_responses
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'));

-- 3. Create nps_team_summaries table for AI-generated summaries
CREATE TABLE IF NOT EXISTS public.nps_team_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.nps_surveys(id) ON DELETE CASCADE,

  -- NULL survey_id = summary of ALL team surveys
  summary_content text NOT NULL,
  summary_type text NOT NULL DEFAULT 'all' CHECK (summary_type IN ('single', 'all')),

  -- AI metadata
  model_used text,
  tokens_used integer,

  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_nps_team_summaries_survey_id
  ON public.nps_team_summaries(survey_id);

CREATE INDEX IF NOT EXISTS idx_nps_team_summaries_generated_at
  ON public.nps_team_summaries(generated_at DESC);

-- RLS
ALTER TABLE public.nps_team_summaries ENABLE ROW LEVEL SECURITY;

-- Only admin and CS can view summaries
CREATE POLICY "Admin and CS can view team summaries"
  ON public.nps_team_summaries
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'));

-- Only admin and CS can insert summaries
CREATE POLICY "Admin and CS can insert team summaries"
  ON public.nps_team_summaries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sucesso_cliente'));
