
-- 1. Adicionar campos novos a products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS task_modes text[] NOT NULL DEFAULT ARRAY['fases']::text[],
  ADD COLUMN IF NOT EXISTS session_count integer,
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer;

-- 2. Adicionar mesmos campos a projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS task_modes text[] NOT NULL DEFAULT ARRAY['fases']::text[],
  ADD COLUMN IF NOT EXISTS session_count integer,
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer;

-- 3. Backfill: levar valor atual de task_mode para o novo array
UPDATE public.products
   SET task_modes = ARRAY[task_mode]
 WHERE task_mode IS NOT NULL
   AND (task_modes IS NULL OR task_modes = ARRAY['fases']::text[] AND task_mode <> 'fases');

UPDATE public.projects
   SET task_modes = ARRAY[task_mode]
 WHERE task_mode IS NOT NULL
   AND (task_modes IS NULL OR task_modes = ARRAY['fases']::text[] AND task_mode <> 'fases');

-- 4. Triggers de sincronização: task_mode reflete sempre task_modes[1] para
--    manter retrocompatibilidade com leitores antigos.
CREATE OR REPLACE FUNCTION public.sync_task_mode_from_modes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.task_modes IS NOT NULL AND array_length(NEW.task_modes, 1) >= 1 THEN
    NEW.task_mode := NEW.task_modes[1];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_mode_products ON public.products;
CREATE TRIGGER trg_sync_task_mode_products
BEFORE INSERT OR UPDATE OF task_modes ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_task_mode_from_modes();

DROP TRIGGER IF EXISTS trg_sync_task_mode_projects ON public.projects;
CREATE TRIGGER trg_sync_task_mode_projects
BEFORE INSERT OR UPDATE OF task_modes ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.sync_task_mode_from_modes();
