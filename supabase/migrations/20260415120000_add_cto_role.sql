-- 20260415120000_add_cto_role.sql
-- Adds 'cto' to user_role enum after 'ceo'.
-- Must run alone (ALTER TYPE ADD VALUE cannot be inside a transaction with code that uses it).
--
-- Scan results (2026-04-15): no existing policies or functions reference 'ceo' literal.
-- is_ceo(uuid) function stays unchanged for identity checks.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cto' AFTER 'ceo';
