
-- L5 — Hardening Equipa

-- Helper: é HR ou admin/owner?
CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR user_in_department('recursos-humanos');
$$;

-- ─── team_member_vacations ───────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert vacations" ON public.team_member_vacations;
DROP POLICY IF EXISTS "Authenticated users can update vacations" ON public.team_member_vacations;
DROP POLICY IF EXISTS "Authenticated users can delete vacations" ON public.team_member_vacations;
-- SELECT mantém aberto a authenticated (planeamento de cobertura)

CREATE POLICY "vacations_insert_self_or_hr"
  ON public.team_member_vacations FOR INSERT TO authenticated
  WITH CHECK (is_self_team_member(member_id) OR is_hr_or_admin());

CREATE POLICY "vacations_update_self_or_hr"
  ON public.team_member_vacations FOR UPDATE TO authenticated
  USING (is_self_team_member(member_id) OR is_hr_or_admin())
  WITH CHECK (is_self_team_member(member_id) OR is_hr_or_admin());

CREATE POLICY "vacations_delete_self_or_hr"
  ON public.team_member_vacations FOR DELETE TO authenticated
  USING (is_self_team_member(member_id) OR is_hr_or_admin());

-- ─── absence_coverage ────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert absence_coverage" ON public.absence_coverage;
DROP POLICY IF EXISTS "Authenticated users can update absence_coverage" ON public.absence_coverage;
DROP POLICY IF EXISTS "Authenticated users can delete absence_coverage" ON public.absence_coverage;

CREATE POLICY "absence_coverage_insert_role_based"
  ON public.absence_coverage FOR INSERT TO authenticated
  WITH CHECK (
    is_hr_or_admin()
    OR is_self_team_member(member_id)
    OR is_self_team_member(substitute_id)
  );

CREATE POLICY "absence_coverage_update_role_based"
  ON public.absence_coverage FOR UPDATE TO authenticated
  USING (
    is_hr_or_admin()
    OR is_self_team_member(member_id)
    OR is_self_team_member(substitute_id)
  )
  WITH CHECK (
    is_hr_or_admin()
    OR is_self_team_member(member_id)
    OR is_self_team_member(substitute_id)
  );

CREATE POLICY "absence_coverage_delete_role_based"
  ON public.absence_coverage FOR DELETE TO authenticated
  USING (
    is_hr_or_admin()
    OR is_self_team_member(member_id)
    OR is_self_team_member(substitute_id)
  );

-- ─── member_onboarding (apertar SELECT) ──────────────────
DROP POLICY IF EXISTS "Authenticated can view member_onboarding" ON public.member_onboarding;

CREATE POLICY "member_onboarding_select_role_based"
  ON public.member_onboarding FOR SELECT TO authenticated
  USING (is_hr_or_admin() OR is_self_team_member(member_id));

-- ─── CHECK team_members ──────────────────────────────────
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('ativo','inativo','ex_membro','suspenso'));

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_member_type_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_member_type_check
  CHECK (member_type IN ('colaborador_fixo','prestador_servicos','estagiario'));
