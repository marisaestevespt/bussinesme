-- Allows checking if current user can open a given project detail page.
CREATE OR REPLACE FUNCTION public.user_can_open_project(_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile uuid;
  v_creator uuid;
  v_client uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  -- Owner / Admin always
  IF public.has_role(v_uid, 'owner') OR public.has_role(v_uid, 'admin') THEN
    RETURN true;
  END IF;

  SELECT id INTO v_profile FROM public.profiles WHERE user_id = v_uid LIMIT 1;
  IF v_profile IS NULL THEN RETURN false; END IF;

  SELECT created_by, client_id INTO v_creator, v_client
  FROM public.projects WHERE id = _project_id;

  IF v_creator IS NOT NULL AND v_creator = v_uid THEN RETURN true; END IF;

  -- Direct project membership
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND profile_id = v_profile
  ) THEN RETURN true; END IF;

  -- Account manager / commercial of the linked client
  IF v_client IS NOT NULL AND public.user_can_open_client(v_client) THEN
    RETURN true;
  END IF;

  -- Responsible for any task in the project
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE project_id = _project_id AND assigned_to = v_profile
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_open_project(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_can_open_project(uuid) TO authenticated;