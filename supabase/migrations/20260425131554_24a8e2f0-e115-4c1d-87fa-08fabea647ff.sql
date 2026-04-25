-- Generic audit trigger function: logs INSERT/UPDATE/DELETE to audit_logs
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _user_name text;
  _action text;
  _entity_id text;
  _entity_type text;
  _label text;
  _meta jsonb := '{}'::jsonb;
BEGIN
  _entity_type := TG_TABLE_NAME;

  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _entity_id := NEW.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _entity_id := NEW.id::text;
    -- Skip pure timestamp updates to avoid noise
    IF to_jsonb(NEW) - 'updated_at' = to_jsonb(OLD) - 'updated_at' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _entity_id := OLD.id::text;
  END IF;

  -- Try to extract a human label from the row
  BEGIN
    IF TG_OP = 'DELETE' THEN
      _label := COALESCE(
        to_jsonb(OLD)->>'name',
        to_jsonb(OLD)->>'title',
        to_jsonb(OLD)->>'full_name',
        to_jsonb(OLD)->>'client',
        to_jsonb(OLD)->>'sale_id'
      );
    ELSE
      _label := COALESCE(
        to_jsonb(NEW)->>'name',
        to_jsonb(NEW)->>'title',
        to_jsonb(NEW)->>'full_name',
        to_jsonb(NEW)->>'client',
        to_jsonb(NEW)->>'sale_id'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _label := NULL;
  END;

  IF _label IS NOT NULL THEN
    _meta := jsonb_build_object('label', _label);
  END IF;

  _user_id := auth.uid();
  IF _user_id IS NOT NULL THEN
    SELECT full_name INTO _user_name FROM public.profiles WHERE user_id = _user_id LIMIT 1;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_name, action, entity_type, entity_id, metadata)
  VALUES (_user_id, COALESCE(_user_name, 'sistema'), _action, _entity_type, _entity_id, _meta);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Never break the source operation
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper: attach audit triggers to a table for INSERT/UPDATE/DELETE
DO $$
DECLARE
  _t text;
  _tables text[] := ARRAY[
    'clients','projects','tasks','crm_leads','financial_expenses',
    'team_members','products','sops','meetings','events',
    'content_items','client_portals','client_assignments',
    'project_deliverables','project_phases','user_roles'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I_ins ON public.%I;', _t, _t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I_upd ON public.%I;', _t, _t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I_del ON public.%I;', _t, _t);

    EXECUTE format('CREATE TRIGGER trg_audit_%I_ins AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();', _t, _t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I_upd AFTER UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();', _t, _t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I_del AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();', _t, _t);
  END LOOP;
END $$;

-- commercial_sales: keep existing status-change trigger, add insert/delete only
DROP TRIGGER IF EXISTS trg_audit_commercial_sales_ins ON public.commercial_sales;
DROP TRIGGER IF EXISTS trg_audit_commercial_sales_del ON public.commercial_sales;
CREATE TRIGGER trg_audit_commercial_sales_ins AFTER INSERT ON public.commercial_sales FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER trg_audit_commercial_sales_del AFTER DELETE ON public.commercial_sales FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- Allow generic action names from triggers (extends original whitelist in log_audit_entry)
-- The function log_audit_entry already accepts 'created','updated','deleted' so manual calls keep working.