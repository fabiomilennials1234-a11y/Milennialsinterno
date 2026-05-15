-- Consolidate profiles SELECT policies: 11 role-specific policies into 1.
--
-- WHY: Every role had its own "can view all profiles" SELECT policy, each
-- calling is_admin() + has_role(). PostgREST ORs all policies together,
-- resulting in ~21 function calls to user_roles per row. For a table that
-- every authenticated user can read, this is pure overhead.
--
-- The 10 role-specific policies collectively grant SELECT to ALL authenticated
-- users (every role is covered). The "group/squad" policy (can_view_user) is
-- therefore redundant. Replace all 11 with a single "authenticated can read".
--
-- Performance impact: profiles SELECT goes from ~75ms to <1ms for single-row
-- lookups by user_id (unique index).

BEGIN;

-- Drop the 10 role-specific "can view all profiles" policies
DROP POLICY IF EXISTS "Consultor Comercial can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Design can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Devs can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Editor Video can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Financeiro can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Gestor CRM can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Gestor de Ads can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Outbound can view all profiles" ON profiles;
DROP POLICY IF EXISTS "RH can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Sucesso do Cliente can view all profiles" ON profiles;

-- Drop the group/squad policy (redundant now, was also redundant before)
DROP POLICY IF EXISTS "Users can view profiles in their group/squad" ON profiles;

-- Single replacement: any authenticated user can SELECT all profiles.
-- This is functionally identical to the 11 policies combined.
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMIT;
