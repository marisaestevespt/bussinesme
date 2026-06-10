
-- 1) Coluna content_phase em tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS content_phase TEXT;

-- 2) Backfill: tarefas existentes herdam o status atual do conteúdo
UPDATE public.tasks t
   SET content_phase = ci.status
  FROM public.content_items ci
 WHERE t.content_id = ci.id
   AND t.content_phase IS NULL;

-- 3) Trigger BEFORE INSERT: gravar a fase do conteúdo na criação da tarefa
CREATE OR REPLACE FUNCTION public.set_task_content_phase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NEW.content_id IS NOT NULL AND NEW.content_phase IS NULL THEN
    SELECT status INTO v_status FROM public.content_items WHERE id = NEW.content_id;
    NEW.content_phase := v_status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_task_content_phase ON public.tasks;
CREATE TRIGGER trg_set_task_content_phase
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_content_phase();

-- 4) Quando o status do conteúdo avança, eliminar tarefas abertas das fases anteriores
CREATE OR REPLACE FUNCTION public.cleanup_outdated_content_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_order integer;
BEGIN
  IF NEW.status IS NULL OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT sort_order INTO v_new_order
    FROM public.content_phase_settings
   WHERE status = NEW.status;

  IF v_new_order IS NULL THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.tasks t
   USING public.content_phase_settings cps
   WHERE t.content_id = NEW.id
     AND t.status <> 'done'
     AND t.content_phase IS NOT NULL
     AND cps.status = t.content_phase
     AND cps.sort_order < v_new_order;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cleanup_outdated_content_tasks ON public.content_items;
CREATE TRIGGER trg_cleanup_outdated_content_tasks
AFTER UPDATE OF status ON public.content_items
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.cleanup_outdated_content_tasks();
