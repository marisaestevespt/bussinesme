
DROP POLICY IF EXISTS "Authenticated can view time entries" ON public.task_time_entries;

CREATE POLICY "tte_select_self_or_managers"
ON public.task_time_entries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR user_in_department('recursos-humanos'::text)
);
