CREATE OR REPLACE FUNCTION public.prevent_team_member_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow owners/admins to change anything
  IF is_admin_or_owner() THEN
    RETURN NEW;
  END IF;

  -- For everyone else (including self-updates), block changes to privileged columns
  IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
     OR NEW.access_suspended IS DISTINCT FROM OLD.access_suspended
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.iban IS DISTINCT FROM OLD.iban
     OR NEW.fiscal_address IS DISTINCT FROM OLD.fiscal_address
     OR NEW.settlement_amount IS DISTINCT FROM OLD.settlement_amount
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
$$;

DROP TRIGGER IF EXISTS trg_prevent_team_member_self_privilege_escalation ON public.team_members;
CREATE TRIGGER trg_prevent_team_member_self_privilege_escalation
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_team_member_self_privilege_escalation();