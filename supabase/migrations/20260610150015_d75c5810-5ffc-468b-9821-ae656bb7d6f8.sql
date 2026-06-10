
DROP POLICY IF EXISTS "Members update own team_member row (non-sensitive)" ON public.team_members;

CREATE POLICY "Members update own team_member row (non-sensitive)"
ON public.team_members
FOR UPDATE
TO authenticated
USING (public.is_self_team_member(id))
WITH CHECK (
  public.is_self_team_member(id)
  AND department          IS NOT DISTINCT FROM (SELECT tm.department          FROM public.team_members tm WHERE tm.id = team_members.id)
  AND departments         IS NOT DISTINCT FROM (SELECT tm.departments         FROM public.team_members tm WHERE tm.id = team_members.id)
  AND custom_role_id      IS NOT DISTINCT FROM (SELECT tm.custom_role_id      FROM public.team_members tm WHERE tm.id = team_members.id)
  AND status              IS NOT DISTINCT FROM (SELECT tm.status              FROM public.team_members tm WHERE tm.id = team_members.id)
  AND profile_id          IS NOT DISTINCT FROM (SELECT tm.profile_id          FROM public.team_members tm WHERE tm.id = team_members.id)
  AND email               IS NOT DISTINCT FROM (SELECT tm.email               FROM public.team_members tm WHERE tm.id = team_members.id)
  AND hourly_cost         IS NOT DISTINCT FROM (SELECT tm.hourly_cost         FROM public.team_members tm WHERE tm.id = team_members.id)
  AND ss_employer_rate    IS NOT DISTINCT FROM (SELECT tm.ss_employer_rate    FROM public.team_members tm WHERE tm.id = team_members.id)
  AND expected_weekly_hours IS NOT DISTINCT FROM (SELECT tm.expected_weekly_hours FROM public.team_members tm WHERE tm.id = team_members.id)
  AND work_areas          IS NOT DISTINCT FROM (SELECT tm.work_areas          FROM public.team_members tm WHERE tm.id = team_members.id)
  AND member_type         IS NOT DISTINCT FROM (SELECT tm.member_type         FROM public.team_members tm WHERE tm.id = team_members.id)
  AND is_external         IS NOT DISTINCT FROM (SELECT tm.is_external         FROM public.team_members tm WHERE tm.id = team_members.id)
  AND access_revoked      IS NOT DISTINCT FROM (SELECT tm.access_revoked      FROM public.team_members tm WHERE tm.id = team_members.id)
  AND access_suspended    IS NOT DISTINCT FROM (SELECT tm.access_suspended    FROM public.team_members tm WHERE tm.id = team_members.id)
  AND access_suspended_at IS NOT DISTINCT FROM (SELECT tm.access_suspended_at FROM public.team_members tm WHERE tm.id = team_members.id)
  AND access_suspended_by IS NOT DISTINCT FROM (SELECT tm.access_suspended_by FROM public.team_members tm WHERE tm.id = team_members.id)
  AND inactivated_at      IS NOT DISTINCT FROM (SELECT tm.inactivated_at      FROM public.team_members tm WHERE tm.id = team_members.id)
  AND settlement_date     IS NOT DISTINCT FROM (SELECT tm.settlement_date     FROM public.team_members tm WHERE tm.id = team_members.id)
  AND settlement_value    IS NOT DISTINCT FROM (SELECT tm.settlement_value    FROM public.team_members tm WHERE tm.id = team_members.id)
  AND settlement_notes    IS NOT DISTINCT FROM (SELECT tm.settlement_notes    FROM public.team_members tm WHERE tm.id = team_members.id)
  AND role_title          IS NOT DISTINCT FROM (SELECT tm.role_title          FROM public.team_members tm WHERE tm.id = team_members.id)
  AND role_color          IS NOT DISTINCT FROM (SELECT tm.role_color          FROM public.team_members tm WHERE tm.id = team_members.id)
  AND responsibilities    IS NOT DISTINCT FROM (SELECT tm.responsibilities    FROM public.team_members tm WHERE tm.id = team_members.id)
  AND start_date          IS NOT DISTINCT FROM (SELECT tm.start_date          FROM public.team_members tm WHERE tm.id = team_members.id)
  AND full_name           IS NOT DISTINCT FROM (SELECT tm.full_name           FROM public.team_members tm WHERE tm.id = team_members.id)
);
