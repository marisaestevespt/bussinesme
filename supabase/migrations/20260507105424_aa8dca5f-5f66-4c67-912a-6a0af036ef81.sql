-- Sync member_payments ↔ financial_payroll for internal collaborators only.
-- Prestadores de serviços (member_type='prestador_servicos') ficam de fora.

CREATE OR REPLACE FUNCTION public.sync_member_payment_to_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member team_members%ROWTYPE;
  v_gross numeric;
  v_irs_rate numeric := 0;        -- placeholder; configurable per member later
  v_ss_emp_rate numeric := 0.11;
  v_ss_company_rate numeric := 0.2375;
  v_irs_value numeric;
  v_ss_emp_value numeric;
  v_ss_company_value numeric;
  v_net numeric;
  v_total_cost numeric;
BEGIN
  -- Only react to salary payments
  IF NEW.payment_type IS DISTINCT FROM 'salario' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_member FROM team_members WHERE id = NEW.member_id;
  IF v_member.id IS NULL OR v_member.member_type IS DISTINCT FROM 'colaborador_fixo' THEN
    -- Not an internal collaborator: do nothing
    RETURN NEW;
  END IF;
  IF v_member.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_gross := COALESCE(NEW.gross_value, 0);
  v_irs_value := round(v_gross * v_irs_rate, 2);
  v_ss_emp_value := round(v_gross * v_ss_emp_rate, 2);
  v_ss_company_value := round(v_gross * v_ss_company_rate, 2);
  v_net := v_gross - v_irs_value - v_ss_emp_value;
  v_total_cost := v_gross + v_ss_company_value;

  INSERT INTO financial_payroll (
    profile_id, collaborator_name, month, year,
    gross_salary, withholding_rate, withholding_value,
    ss_employee, ss_employer, net_salary, total_cost,
    status, created_by
  ) VALUES (
    v_member.profile_id, v_member.full_name, NEW.month, NEW.year,
    v_gross, v_irs_rate, v_irs_value,
    v_ss_emp_value, v_ss_company_value, v_net, v_total_cost,
    NEW.status, auth.uid()
  )
  ON CONFLICT DO NOTHING;

  -- If a row already exists for (profile_id, month, year), update it instead
  UPDATE financial_payroll
     SET gross_salary = v_gross,
         withholding_rate = v_irs_rate,
         withholding_value = v_irs_value,
         ss_employee = v_ss_emp_value,
         ss_employer = v_ss_company_value,
         net_salary = v_net,
         total_cost = v_total_cost,
         status = NEW.status,
         collaborator_name = v_member.full_name,
         updated_at = now()
   WHERE profile_id = v_member.profile_id
     AND month = NEW.month
     AND year = NEW.year;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cascade_delete_payment_to_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF OLD.payment_type IS DISTINCT FROM 'salario' THEN
    RETURN OLD;
  END IF;

  SELECT profile_id INTO v_profile_id FROM team_members WHERE id = OLD.member_id;
  IF v_profile_id IS NULL THEN
    RETURN OLD;
  END IF;

  DELETE FROM financial_payroll
   WHERE profile_id = v_profile_id
     AND month = OLD.month
     AND year = OLD.year;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_to_payroll ON member_payments;
CREATE TRIGGER trg_sync_payment_to_payroll
AFTER INSERT OR UPDATE ON member_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_member_payment_to_payroll();

DROP TRIGGER IF EXISTS trg_cascade_delete_payment_to_payroll ON member_payments;
CREATE TRIGGER trg_cascade_delete_payment_to_payroll
AFTER DELETE ON member_payments
FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_payment_to_payroll();