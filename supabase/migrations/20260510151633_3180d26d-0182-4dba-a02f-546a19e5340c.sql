-- Auto-assign project deliverable to a project member based on responsible_role (work area)
-- Strategy: least-load round-robin among eligible members in the project

CREATE OR REPLACE FUNCTION public.auto_assign_deliverable_by_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee uuid;
BEGIN
  -- Only act when assignment is missing, team is responsible, and a role is set
  IF NEW.assigned_to IS NOT NULL
     OR COALESCE(NEW.responsible_type, 'equipa') <> 'equipa'
     OR NEW.responsible_role IS NULL
     OR NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pm.profile_id
    INTO v_assignee
  FROM public.project_members pm
  JOIN public.team_members tm ON tm.profile_id = pm.profile_id
  WHERE pm.project_id = NEW.project_id
    AND tm.status = 'ativo'
    AND tm.work_areas ? NEW.responsible_role
  ORDER BY (
    SELECT COUNT(*)
    FROM public.project_deliverables pd
    WHERE pd.project_id = NEW.project_id
      AND pd.assigned_to = pm.profile_id
  ) ASC, pm.profile_id ASC
  LIMIT 1;

  IF v_assignee IS NOT NULL THEN
    NEW.assigned_to := v_assignee;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_deliverable_by_role ON public.project_deliverables;
CREATE TRIGGER trg_auto_assign_deliverable_by_role
BEFORE INSERT ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_deliverable_by_role();