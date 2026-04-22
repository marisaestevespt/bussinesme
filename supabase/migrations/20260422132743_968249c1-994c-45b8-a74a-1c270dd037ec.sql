CREATE OR REPLACE FUNCTION public.audit_commercial_sales_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _user_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    _user_id := auth.uid();
    IF _user_id IS NOT NULL THEN
      SELECT full_name INTO _user_name FROM public.profiles WHERE user_id = _user_id LIMIT 1;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_name, action, entity_type, entity_id, metadata)
    VALUES (
      _user_id,
      COALESCE(_user_name, 'sistema'),
      'status_change',
      'commercial_sales',
      NEW.id::text,
      jsonb_build_object(
        'sale_id', NEW.sale_id,
        'client', NEW.client,
        'invoice_total', NEW.invoice_total,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_commercial_sales_status ON public.commercial_sales;
CREATE TRIGGER trg_audit_commercial_sales_status
AFTER UPDATE ON public.commercial_sales
FOR EACH ROW
EXECUTE FUNCTION public.audit_commercial_sales_status();