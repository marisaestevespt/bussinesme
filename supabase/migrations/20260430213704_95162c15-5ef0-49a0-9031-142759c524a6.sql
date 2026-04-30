-- Backfill: projetos com client_id ficam no dpt clientes
UPDATE public.projects
SET department = 'clientes'
WHERE client_id IS NOT NULL
  AND (department IS NULL OR department = '' OR department <> 'clientes');

-- Trigger: forçar department='clientes' quando há client_id
CREATE OR REPLACE FUNCTION public.enforce_client_project_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    NEW.department := 'clientes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_client_project_department ON public.projects;
CREATE TRIGGER trg_enforce_client_project_department
BEFORE INSERT OR UPDATE OF client_id, department ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_project_department();