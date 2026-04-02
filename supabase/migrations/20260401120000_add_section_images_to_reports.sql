-- Add section_images JSONB column to store per-section image URLs
-- Format: { "actionsLast30Days": ["url1"], "achievements": ["url2"], ... }
ALTER TABLE public.client_results_reports
  ADD COLUMN IF NOT EXISTS section_images JSONB DEFAULT '{}'::jsonb;
