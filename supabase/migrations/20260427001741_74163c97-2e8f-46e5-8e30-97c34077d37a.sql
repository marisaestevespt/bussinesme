
-- 1. Adicionar colunas em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_since date,
  ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_renewal_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 2. Backfill client_since
UPDATE public.clients SET client_since = start_date WHERE client_since IS NULL;

-- 3. Tabela client_renewals
CREATE TABLE IF NOT EXISTS public.client_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL DEFAULT 1,
  phase text,
  activity text NOT NULL,
  responsible text,
  rule text,
  rule_days integer,
  rule_unit text DEFAULT 'dias',
  rule_trigger text DEFAULT 'antes_fim_ciclo',
  due_date date,
  sort_order integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  documents_links text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_renewals_client ON public.client_renewals(client_id);
CREATE INDEX IF NOT EXISTS idx_client_renewals_cycle ON public.client_renewals(client_id, cycle_number);

ALTER TABLE public.client_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_renewals_select" ON public.client_renewals FOR SELECT TO authenticated
USING (public.user_can_access_client(client_id));

CREATE POLICY "client_renewals_insert" ON public.client_renewals FOR INSERT TO authenticated
WITH CHECK (public.user_can_access_client(client_id));

CREATE POLICY "client_renewals_update" ON public.client_renewals FOR UPDATE TO authenticated
USING (public.user_can_access_client(client_id))
WITH CHECK (public.user_can_access_client(client_id));

CREATE POLICY "client_renewals_delete" ON public.client_renewals FOR DELETE TO authenticated
USING (public.user_can_access_client(client_id));

CREATE TRIGGER update_client_renewals_updated_at
BEFORE UPDATE ON public.client_renewals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tabela product_renewal_templates
CREATE TABLE IF NOT EXISTS public.product_renewal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  responsible_type text DEFAULT 'equipa',
  is_meeting boolean NOT NULL DEFAULT false,
  deliverable_type text DEFAULT 'tarefa',
  notes text,
  rule_days integer,
  rule_unit text DEFAULT 'dias',
  rule_trigger text DEFAULT 'antes_fim_ciclo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_renewal_templates_product ON public.product_renewal_templates(product_id);

ALTER TABLE public.product_renewal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_renewal_templates_select" ON public.product_renewal_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "product_renewal_templates_modify" ON public.product_renewal_templates FOR ALL TO authenticated
USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
)
WITH CHECK (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
);

CREATE TRIGGER update_product_renewal_templates_updated_at
BEFORE UPDATE ON public.product_renewal_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Adicionar coluna renewal_id em tasks (para ligação à checklist)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS renewal_id uuid REFERENCES public.client_renewals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_renewal ON public.tasks(renewal_id);

-- 6. Trigger sync_renewal_to_task (espelha sync_onboarding_to_task)
CREATE OR REPLACE FUNCTION public.sync_renewal_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _assignee uuid;
  _existing_task uuid;
  _client_name text;
BEGIN
  SELECT full_name INTO _client_name FROM public.clients WHERE id = NEW.client_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, renewal_id)
    VALUES (
      'Renovação — ' || COALESCE(_client_name, 'Cliente') || ' — ' || NEW.activity,
      CASE WHEN NEW.completed THEN 'done' ELSE 'por_comecar' END,
      'media',
      NEW.due_date,
      _assignee,
      'Renovação',
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT id INTO _existing_task FROM public.tasks WHERE renewal_id = NEW.id LIMIT 1;
    IF _existing_task IS NULL THEN
      INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, renewal_id)
      VALUES (
        'Renovação — ' || COALESCE(_client_name, 'Cliente') || ' — ' || NEW.activity,
        CASE WHEN NEW.completed THEN 'done' ELSE 'por_comecar' END,
        'media', NEW.due_date, _assignee, 'Renovação', NEW.id
      );
    ELSE
      UPDATE public.tasks
      SET name = 'Renovação — ' || COALESCE(_client_name, 'Cliente') || ' — ' || NEW.activity,
          deadline = NEW.due_date,
          status = CASE
            WHEN NEW.completed AND status <> 'done' THEN 'done'
            WHEN NOT NEW.completed AND status = 'done' THEN 'por_comecar'
            ELSE status
          END,
          updated_at = now()
      WHERE id = _existing_task;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_renewal_to_task_trg
AFTER INSERT OR UPDATE ON public.client_renewals
FOR EACH ROW EXECUTE FUNCTION public.sync_renewal_to_task();
