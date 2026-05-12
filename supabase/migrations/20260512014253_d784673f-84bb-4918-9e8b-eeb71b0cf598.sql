
-- 1) Settings table for phase offsets
CREATE TABLE public.content_phase_settings (
  status TEXT PRIMARY KEY,
  days_before_publish INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_phase_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Phase settings viewable by authenticated"
ON public.content_phase_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Phase settings managed by owner"
ON public.content_phase_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER content_phase_settings_updated_at
BEFORE UPDATE ON public.content_phase_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults (relative to publication date)
INSERT INTO public.content_phase_settings (status, days_before_publish, sort_order) VALUES
  ('em_ideia',           21, 10),
  ('pronto_para_copy',   18, 20),
  ('em_copy',            14, 30),
  ('pronto_para_design', 10, 40),
  ('em_design',           7, 50),
  ('gravar',             12, 60),
  ('editar',              5, 70),
  ('aprovacao_final',     3, 80),
  ('tudo_pronto',         2, 90),
  ('agendado',            1, 100)
ON CONFLICT (status) DO NOTHING;

-- 2) Per-content overrides
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS phase_deadlines JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Helper: compute deadline for a (content, phase)
CREATE OR REPLACE FUNCTION public.compute_phase_deadline(p_content_id uuid, p_status text)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scheduled date;
  v_overrides jsonb;
  v_override  text;
  v_days      integer;
BEGIN
  SELECT scheduled_at::date, COALESCE(phase_deadlines, '{}'::jsonb)
    INTO v_scheduled, v_overrides
    FROM public.content_items
   WHERE id = p_content_id;

  IF v_scheduled IS NULL THEN
    RETURN NULL;
  END IF;

  v_override := v_overrides->>p_status;
  IF v_override IS NOT NULL AND v_override <> '' THEN
    BEGIN
      RETURN v_override::date;
    EXCEPTION WHEN OTHERS THEN
      -- fall through
    END;
  END IF;

  SELECT days_before_publish INTO v_days
    FROM public.content_phase_settings
   WHERE status = p_status AND enabled = true;

  IF v_days IS NULL THEN
    RETURN v_scheduled;
  END IF;

  RETURN v_scheduled - v_days;
END $$;

-- 4) BEFORE INSERT on tasks: auto-set deadline for content tasks
CREATE OR REPLACE FUNCTION public.set_content_task_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NEW.content_id IS NOT NULL AND NEW.deadline IS NULL THEN
    SELECT status INTO v_status FROM public.content_items WHERE id = NEW.content_id;
    IF v_status IS NOT NULL THEN
      NEW.deadline := public.compute_phase_deadline(NEW.content_id, v_status);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_set_content_task_deadline
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_content_task_deadline();

-- 5) AFTER UPDATE on content_items: recompute open task deadline when relevant fields change
CREATE OR REPLACE FUNCTION public.sync_content_task_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tasks
     SET deadline = public.compute_phase_deadline(NEW.id, NEW.status),
         updated_at = now()
   WHERE content_id = NEW.id
     AND status <> 'done';
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_content_task_deadline
AFTER UPDATE OF scheduled_at, status, phase_deadlines ON public.content_items
FOR EACH ROW
WHEN (
  OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at
  OR OLD.status IS DISTINCT FROM NEW.status
  OR OLD.phase_deadlines IS DISTINCT FROM NEW.phase_deadlines
)
EXECUTE FUNCTION public.sync_content_task_deadline();

-- 6) AFTER UPDATE on content_phase_settings: recompute deadlines for all open content tasks
CREATE OR REPLACE FUNCTION public.recompute_content_task_deadlines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tasks t
     SET deadline = public.compute_phase_deadline(t.content_id, ci.status),
         updated_at = now()
    FROM public.content_items ci
   WHERE t.content_id = ci.id
     AND t.status <> 'done';
  RETURN NEW;
END $$;

CREATE TRIGGER trg_recompute_after_phase_settings
AFTER INSERT OR UPDATE OR DELETE ON public.content_phase_settings
FOR EACH STATEMENT
EXECUTE FUNCTION public.recompute_content_task_deadlines();

-- 7) Backfill: recompute deadline for all open content tasks now
UPDATE public.tasks t
   SET deadline = public.compute_phase_deadline(t.content_id, ci.status),
       updated_at = now()
  FROM public.content_items ci
 WHERE t.content_id = ci.id
   AND t.status <> 'done';
