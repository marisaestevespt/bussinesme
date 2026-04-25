
-- =========================================================
-- 1) PRIVILEGE_ESCALATION on team_members
-- =========================================================

-- Drop existing self-update policy (if present under any of the known names)
DROP POLICY IF EXISTS "Owner or self updates team_members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update" ON public.team_members;
DROP POLICY IF EXISTS "Self or owner can update team_members" ON public.team_members;

-- Trigger that blocks self-update of sensitive fields unless caller is owner/admin
CREATE OR REPLACE FUNCTION public.protect_team_members_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_priv boolean;
BEGIN
  _is_priv := public.is_admin_or_owner();

  IF _is_priv THEN
    RETURN NEW;
  END IF;

  -- Only allow self-update path here; cross-user updates blocked by RLS already.
  IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.departments IS DISTINCT FROM OLD.departments
     OR NEW.access_suspended IS DISTINCT FROM OLD.access_suspended
     OR NEW.access_revoked IS DISTINCT FROM OLD.access_revoked
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.hourly_cost IS DISTINCT FROM OLD.hourly_cost
     OR NEW.settlement_value IS DISTINCT FROM OLD.settlement_value
     OR NEW.settlement_date IS DISTINCT FROM OLD.settlement_date
     OR NEW.settlement_notes IS DISTINCT FROM OLD.settlement_notes
     OR NEW.role_title IS DISTINCT FROM OLD.role_title
     OR NEW.work_areas IS DISTINCT FROM OLD.work_areas
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.inactivated_at IS DISTINCT FROM OLD.inactivated_at
  THEN
    RAISE EXCEPTION 'Não tens permissão para alterar campos sensíveis do teu perfil de equipa.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_team_members_sensitive ON public.team_members;
CREATE TRIGGER trg_protect_team_members_sensitive
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_team_members_sensitive_fields();

-- Recreate UPDATE policies: owner/admin can update anyone; members can update only themselves (sensitive fields blocked by trigger)
CREATE POLICY "Owners/Admins update any team_member"
ON public.team_members
FOR UPDATE
TO authenticated
USING (public.is_admin_or_owner())
WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Members update own team_member row (non-sensitive)"
ON public.team_members
FOR UPDATE
TO authenticated
USING (public.is_self_team_member(id))
WITH CHECK (public.is_self_team_member(id));

-- =========================================================
-- 2) profiles.phone exposure
-- =========================================================

-- Replace the broad SELECT policy with self/admin-only access.
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Self or admin/owner can view full profile rows (incl. phone)
CREATE POLICY "Self or admin views profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_owner());

-- Public-safe view (no phone) for cross-user lookups (mentions, names, avatars).
-- security_invoker=on so RLS of underlying table applies — but we need cross-user reads,
-- so we expose this via SECURITY DEFINER instead.
DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;
