-- Fix 1: Reassign orphan content tasks
UPDATE public.tasks
SET assigned_to = created_by,
    deadline = COALESCE(deadline, CURRENT_DATE + 7)
WHERE assigned_to IS NULL
  AND created_by IS NOT NULL
  AND name LIKE '[Conteúdo]%'
  AND status NOT IN ('done','concluida','cancelada');

-- Fix 2: Normalize duplicated status
UPDATE public.tasks SET status = 'por_comecar' WHERE status = 'pendente';

-- Fix 3: Default assignee trigger
CREATE OR REPLACE FUNCTION public.default_task_assignee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.assigned_to := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_task_assignee ON public.tasks;
CREATE TRIGGER trg_default_task_assignee
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.default_task_assignee();