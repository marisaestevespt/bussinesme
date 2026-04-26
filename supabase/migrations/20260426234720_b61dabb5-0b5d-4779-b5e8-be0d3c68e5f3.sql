
CREATE OR REPLACE FUNCTION public.audit_commercial_sales_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _user_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    _user_id := auth.uid();
    -- Skip audit logging for system-level operations (no auth context)
    IF _user_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT full_name INTO _user_name FROM public.profiles WHERE user_id = _user_id LIMIT 1;

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
$function$;
