-- Add additional_pages column to profiles table
-- Stores extra page access granted beyond the role's default pages
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS additional_pages TEXT[] DEFAULT '{}';
