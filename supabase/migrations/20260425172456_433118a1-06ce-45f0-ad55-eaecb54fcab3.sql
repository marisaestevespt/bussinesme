-- ============================================================
-- 1. member_quick_links
-- ============================================================
CREATE TABLE public.member_quick_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  url text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  icon jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_quick_links_member_id ON public.member_quick_links(member_id);

ALTER TABLE public.member_quick_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Self or admin can view quick links"
ON public.member_quick_links FOR SELECT TO authenticated
USING (public.is_self_team_member(member_id) OR public.is_admin_or_owner());

CREATE POLICY "Self or admin can insert quick links"
ON public.member_quick_links FOR INSERT TO authenticated
WITH CHECK (public.is_self_team_member(member_id) OR public.is_admin_or_owner());

CREATE POLICY "Self or admin can update quick links"
ON public.member_quick_links FOR UPDATE TO authenticated
USING (public.is_self_team_member(member_id) OR public.is_admin_or_owner());

CREATE POLICY "Self or admin can delete quick links"
ON public.member_quick_links FOR DELETE TO authenticated
USING (public.is_self_team_member(member_id) OR public.is_admin_or_owner());

CREATE TRIGGER trg_member_quick_links_updated_at
BEFORE UPDATE ON public.member_quick_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Onboarding ↔ Tasks sync
-- ============================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS onboarding_id uuid REFERENCES public.member_onboarding(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_onboarding_id ON public.tasks(onboarding_id);

-- Create / update task when onboarding step is created or modified
CREATE OR REPLACE FUNCTION public.sync_onboarding_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _assignee uuid;
  _existing_task uuid;
BEGIN
  -- Resolve assignee = profile of the team member
  SELECT profile_id INTO _assignee FROM public.team_members WHERE id = NEW.member_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, onboarding_id)
    VALUES (
      NEW.task,
      CASE WHEN NEW.completed THEN 'done' ELSE 'por_comecar' END,
      'media',
      NEW.deadline_date,
      _assignee,
      'Onboarding',
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT id INTO _existing_task FROM public.tasks WHERE onboarding_id = NEW.id LIMIT 1;
    IF _existing_task IS NULL THEN
      INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, onboarding_id)
      VALUES (
        NEW.task,
        CASE WHEN NEW.completed THEN 'done' ELSE 'por_comecar' END,
        'media', NEW.deadline_date, _assignee, 'Onboarding', NEW.id
      );
    ELSE
      UPDATE public.tasks
      SET name = NEW.task,
          deadline = NEW.deadline_date,
          status = CASE
            WHEN NEW.completed AND status <> 'done' THEN 'done'
            WHEN NOT NEW.completed AND status = 'done' THEN 'por_comecar'
            ELSE status
          END,
          assigned_to = COALESCE(assigned_to, _assignee),
          updated_at = now()
      WHERE id = _existing_task;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_onboarding_to_task ON public.member_onboarding;
CREATE TRIGGER trg_sync_onboarding_to_task
AFTER INSERT OR UPDATE ON public.member_onboarding
FOR EACH ROW EXECUTE FUNCTION public.sync_onboarding_to_task();

-- Reverse sync: when the task is marked done, mark the onboarding step
CREATE OR REPLACE FUNCTION public.sync_task_status_to_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.member_onboarding
    SET completed = (NEW.status = 'done')
    WHERE id = NEW.onboarding_id
      AND completed IS DISTINCT FROM (NEW.status = 'done');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_to_onboarding ON public.tasks;
CREATE TRIGGER trg_sync_task_to_onboarding
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_status_to_onboarding();

-- Backfill: create tasks for existing onboarding steps without a task
INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, onboarding_id)
SELECT mo.task,
       CASE WHEN mo.completed THEN 'done' ELSE 'por_comecar' END,
       'media',
       mo.deadline_date,
       tm.profile_id,
       'Onboarding',
       mo.id
FROM public.member_onboarding mo
JOIN public.team_members tm ON tm.id = mo.member_id
LEFT JOIN public.tasks t ON t.onboarding_id = mo.id
WHERE t.id IS NULL;