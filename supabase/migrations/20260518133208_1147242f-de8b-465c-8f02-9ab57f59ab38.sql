DROP POLICY IF EXISTS "Team members can manage project recurring occurrences" ON public.project_recurring_occurrences;

CREATE POLICY "Team roles can manage project recurring occurrences"
ON public.project_recurring_occurrences
FOR ALL
TO authenticated
USING (
  public.is_active_team_member()
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  public.is_active_team_member()
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);