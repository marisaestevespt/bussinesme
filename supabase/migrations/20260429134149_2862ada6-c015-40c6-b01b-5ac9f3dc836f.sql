-- ============================================================
-- P1.1: Suspensão global de membros
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_is_suspended()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.profile_id
    WHERE p.user_id = auth.uid()
      AND tm.access_suspended = true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_is_suspended() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_suspended() TO authenticated;

-- Apply restrictive policy to every public table (denies ALL ops when suspended).
-- Owner is never suspended (no team_members row tied to suspension flow).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "block_suspended_users" ON public.%I',
      r.tablename
    );
    EXECUTE format(
      'CREATE POLICY "block_suspended_users" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.current_user_is_suspended()) WITH CHECK (NOT public.current_user_is_suspended())',
      r.tablename
    );
  END LOOP;
END $$;

-- ============================================================
-- P1.2: system_config read-restricted to Owner/Admin
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='system_config' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_config', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "system_config_select_admin_owner"
ON public.system_config
FOR SELECT
TO authenticated
USING (public.is_admin_or_owner());

-- ============================================================
-- P1.3: portal_visits — only allow inserts with known emails
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='portal_visits' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.portal_visits', r.policyname);
  END LOOP;
END $$;

-- Anonymous insert allowed only when:
--   1) the portal token is active, AND
--   2) the email matches a known client/contact/team email for that portal.
CREATE POLICY "portal_visits_insert_validated"
ON public.portal_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portals cp
    WHERE cp.id = portal_visits.portal_id
      AND cp.is_active = true
      AND public.portal_email_allowed(cp.token, portal_visits.email)
  )
);
