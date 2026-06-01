-- Forçar projetos a herdar sempre project_mode e task_mode(s) do produto

CREATE OR REPLACE FUNCTION public.enforce_project_modes_from_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_mode text;
  v_task_mode text;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT default_project_mode, task_mode
    INTO v_default_mode, v_task_mode
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_default_mode IS NOT NULL THEN
    NEW.project_mode := v_default_mode;
  END IF;

  IF v_task_mode IS NOT NULL THEN
    NEW.task_mode := v_task_mode;
    NEW.task_modes := ARRAY[v_task_mode];
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_modes_from_product ON public.projects;
CREATE TRIGGER trg_enforce_project_modes_from_product
BEFORE INSERT OR UPDATE OF product_id, project_mode, task_mode, task_modes
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_project_modes_from_product();

-- Propagar mudanças do produto para todos os projetos que o usam
CREATE OR REPLACE FUNCTION public.propagate_product_modes_to_projects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.default_project_mode IS DISTINCT FROM OLD.default_project_mode
     OR NEW.task_mode IS DISTINCT FROM OLD.task_mode THEN
    UPDATE public.projects
       SET project_mode = NEW.default_project_mode,
           task_mode    = NEW.task_mode,
           task_modes   = ARRAY[NEW.task_mode]
     WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_product_modes_to_projects ON public.products;
CREATE TRIGGER trg_propagate_product_modes_to_projects
AFTER UPDATE OF default_project_mode, task_mode
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.propagate_product_modes_to_projects();

-- Alinhar projetos existentes (corrige a Bianca)
UPDATE public.projects pr
   SET project_mode = p.default_project_mode,
       task_mode    = p.task_mode,
       task_modes   = ARRAY[p.task_mode]
  FROM public.products p
 WHERE p.id = pr.product_id
   AND (pr.project_mode IS DISTINCT FROM p.default_project_mode
        OR pr.task_mode IS DISTINCT FROM p.task_mode
        OR pr.task_modes IS DISTINCT FROM ARRAY[p.task_mode]);