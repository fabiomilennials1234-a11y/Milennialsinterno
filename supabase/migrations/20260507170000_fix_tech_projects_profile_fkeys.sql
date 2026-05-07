-- Fix PostgREST joins: add FK constraints from tech_projects/tech_project_members to profiles
-- Original FKs point to auth.users, which PostgREST can't expose. These additional FKs
-- point to profiles(user_id) so PostgREST can resolve the join for lead/member names.

ALTER TABLE tech_projects
  ADD CONSTRAINT tech_projects_lead_id_profiles_fkey
  FOREIGN KEY (lead_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE tech_project_members
  ADD CONSTRAINT tech_project_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
