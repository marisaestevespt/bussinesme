
-- 1. Add ss_employer_rate per team_member (default 23.75% PT)
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS ss_employer_rate numeric NOT NULL DEFAULT 0.2375;

-- 2. Simplify payroll sync trigger: only gross + SS empresa + total cost
CREATE OR REPLACE FUNCTION public.sync_member_payment_to_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_type text;
  v_ss_rate numeric;
  v_member_name text;
  v_profile_id uuid;
  v_ss_employer numeric;
  v_total_cost numeric;
BEGIN
  -- Only process salary payments
  IF NEW.payment_type <> 'salario' THEN
    RETURN NEW;
  END IF;

  SELECT tm.contract_type,
         COALESCE(tm.ss_employer_rate, 0.2375),
         COALESCE(tm.full_name, tm.name, 'Colaborador'),
         tm.profile_id
    INTO v_contract_type, v_ss_rate, v_member_name, v_profile_id
  FROM public.team_members tm
  WHERE tm.id = NEW.member_id;

  -- Only colaborador_fixo gets a payroll line
  IF v_contract_type IS DISTINCT FROM 'colaborador_fixo' THEN
    RETURN NEW;
  END IF;

  v_ss_employer := ROUND(NEW.gross_value * v_ss_rate, 2);
  v_total_cost := NEW.gross_value + v_ss_employer;

  INSERT INTO public.financial_payroll (
    profile_id, collaborator_name, month, year,
    gross_salary, withholding_rate, withholding_value,
    ss_employee, ss_employer, net_salary, total_cost, status
  ) VALUES (
    v_profile_id, v_member_name, NEW.month, NEW.year,
    NEW.gross_value, 0, 0,
    0, v_ss_employer, NEW.gross_value, v_total_cost, NEW.status
  )
  ON CONFLICT DO NOTHING;

  -- Update if already exists (match by profile + period)
  UPDATE public.financial_payroll
  SET gross_salary = NEW.gross_value,
      ss_employer = v_ss_employer,
      net_salary = NEW.gross_value,
      total_cost = v_total_cost,
      status = NEW.status,
      updated_at = now()
  WHERE profile_id = v_profile_id
    AND month = NEW.month
    AND year = NEW.year;

  RETURN NEW;
END;
$$;
