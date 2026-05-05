
-- 1) Remove permissive INSERT on commercial_sales
DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.commercial_sales;

-- 2) Prevent privilege escalation via self-update on team_members
CREATE OR REPLACE FUNCTION public.prevent_team_member_sensitive_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins/owners can change anything
  IF public.is_admin_or_owner() THEN
    RETURN NEW;
  END IF;

  -- For everyone else (i.e. self-update path), block sensitive column changes
  IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
     OR NEW.access_suspended IS DISTINCT FROM OLD.access_suspended
     OR NEW.hourly_cost IS DISTINCT FROM OLD.hourly_cost
     OR NEW.iban IS DISTINCT FROM OLD.iban
     OR NEW.fiscal_address IS DISTINCT FROM OLD.fiscal_address
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.identification IS DISTINCT FROM OLD.identification
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.role_title IS DISTINCT FROM OLD.role_title
     OR NEW.full_name IS DISTINCT FROM OLD.full_name
  THEN
    RAISE EXCEPTION 'Não tens permissão para alterar campos sensíveis no teu próprio perfil';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_team_member_sensitive_self_update ON public.team_members;
CREATE TRIGGER trg_prevent_team_member_sensitive_self_update
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_team_member_sensitive_self_update();
