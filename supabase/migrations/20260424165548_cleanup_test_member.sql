-- Cleanup test member "Teste Lyrata" and related records
DO $$
DECLARE
  _member_id uuid;
  _member_name text;
BEGIN
  SELECT id, full_name INTO _member_id, _member_name
  FROM public.team_members
  WHERE full_name = 'Teste Lyrata'
  LIMIT 1;

  IF _member_id IS NOT NULL THEN
    DELETE FROM public.member_payments WHERE member_id = _member_id;
    DELETE FROM public.member_contracts WHERE member_id = _member_id;
    DELETE FROM public.member_onboarding WHERE member_id = _member_id;
    DELETE FROM public.feedback_sessions WHERE member_id = _member_id;
    DELETE FROM public.performance_weekly WHERE member_id = _member_id;
    DELETE FROM public.performance_monthly WHERE member_id = _member_id;
    DELETE FROM public.member_sensitive_access WHERE member_id = _member_id;
    DELETE FROM public.financial_payroll WHERE collaborator_name = _member_name;
    DELETE FROM public.team_members WHERE id = _member_id;
  END IF;
END $$;
