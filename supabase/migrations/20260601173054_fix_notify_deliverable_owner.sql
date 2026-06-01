-- Fix: projects table has no assigned_to column; fall back to created_by
CREATE OR REPLACE FUNCTION public.notify_deliverable_schedule_overrun()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _msg text;
  _link text;
BEGIN
  IF NEW.scheduled_date IS NULL OR NEW.deadline IS NULL THEN RETURN NEW; END IF;
  IF NEW.scheduled_date <= NEW.deadline THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.scheduled_date IS NOT DISTINCT FROM NEW.scheduled_date
     AND OLD.deadline IS NOT DISTINCT FROM NEW.deadline THEN
    RETURN NEW;
  END IF;

  _owner_id := COALESCE(
    NEW.assigned_to,
    (SELECT created_by FROM public.projects WHERE id = NEW.project_id)
  );
  IF _owner_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _owner_id) THEN
    RETURN NEW;
  END IF;

  _msg := 'A entrega "' || NEW.name || '" tem data de execução posterior ao deadline.';
  _link := '/projetos/' || NEW.project_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_owner_id, 'warning', 'Data de execução ultrapassa deadline', _msg, _link);

  RETURN NEW;
END;
$$;
