
-- Column-level lockdown: hide phone/bio/work_schedule from regular SELECT
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, full_name, avatar_url, role_title, icon,
  onboarding_completed, created_at, updated_at
) ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;

-- SECURITY DEFINER RPC: self can fetch own full profile (including sensitive cols)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- SECURITY DEFINER RPC: managers (owner/admin/HR) can fetch any profile fully
CREATE OR REPLACE FUNCTION public.get_profile_admin(_user_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  IF NOT (
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_staff'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR user_in_department('recursos-humanos'::text)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT * INTO result FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_admin(uuid) TO authenticated;
