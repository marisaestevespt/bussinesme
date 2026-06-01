CREATE OR REPLACE FUNCTION public.prevent_team_member_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF is_admin_or_owner() THEN
    RETURN NEW;
  END IF;

  IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
     OR NEW.access_suspended IS DISTINCT FROM OLD.access_suspended
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.iban IS DISTINCT FROM OLD.iban
     OR NEW.fiscal_address IS DISTINCT FROM OLD.fiscal_address
     OR NEW.settlement_value IS DISTINCT FROM OLD.settlement_value
     OR NEW.settlement_date IS DISTINCT FROM OLD.settlement_date
     OR NEW.settlement_notes IS DISTINCT FROM OLD.settlement_notes
     OR NEW.settlement_status IS DISTINCT FROM OLD.settlement_status
     OR NEW.offboarded_at IS DISTINCT FROM OLD.offboarded_at
     OR NEW.offboarding_reason IS DISTINCT FROM OLD.offboarding_reason
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Não tem permissão para alterar campos sensíveis do membro';
  END IF;

  RETURN NEW;
END;
$function$;