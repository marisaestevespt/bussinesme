-- Bypass the per-row "protect sensitive fields" trigger only for this admin-level backfill.
SET LOCAL session_replication_role = replica;

UPDATE public.team_members tm
SET work_areas = jsonb_build_array(cr.name)
FROM public.custom_roles cr
WHERE cr.id = tm.custom_role_id;

UPDATE public.team_members
SET work_areas = '[]'::jsonb
WHERE custom_role_id IS NULL
  AND work_areas IS NOT NULL
  AND work_areas <> '[]'::jsonb;

SET LOCAL session_replication_role = origin;

-- Trigger: keep work_areas in sync with custom_role_id automatically (BEFORE on team_members)
CREATE OR REPLACE FUNCTION public.sync_team_member_work_areas_from_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
BEGIN
  IF NEW.custom_role_id IS NULL THEN
    NEW.work_areas := '[]'::jsonb;
  ELSE
    SELECT name INTO v_role_name FROM public.custom_roles WHERE id = NEW.custom_role_id;
    IF v_role_name IS NOT NULL THEN
      NEW.work_areas := jsonb_build_array(v_role_name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_team_member_work_areas ON public.team_members;
CREATE TRIGGER trg_sync_team_member_work_areas
BEFORE INSERT OR UPDATE OF custom_role_id ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_member_work_areas_from_role();

-- Trigger: when a custom_role is renamed, propagate to team_members.work_areas
-- (admins/owners only — they're the only ones who can rename roles anyway)
CREATE OR REPLACE FUNCTION public.propagate_role_rename_to_work_areas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    PERFORM set_config('session_replication_role', 'replica', true);
    UPDATE public.team_members
    SET work_areas = jsonb_build_array(NEW.name)
    WHERE custom_role_id = NEW.id;
    PERFORM set_config('session_replication_role', 'origin', true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_role_rename ON public.custom_roles;
CREATE TRIGGER trg_propagate_role_rename
AFTER UPDATE OF name ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION public.propagate_role_rename_to_work_areas();