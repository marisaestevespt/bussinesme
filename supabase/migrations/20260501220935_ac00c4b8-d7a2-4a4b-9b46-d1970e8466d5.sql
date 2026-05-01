-- K.A: Apertar RLS de weekly_align_notes (executive-level data)
DROP POLICY IF EXISTS "Authenticated users can manage weekly notes" ON public.weekly_align_notes;

CREATE POLICY "Owners admins and strategic can view weekly notes"
ON public.weekly_align_notes FOR SELECT
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR current_user_has_sensitive_access('strategic'::text)
);

CREATE POLICY "Owners admins and strategic can insert weekly notes"
ON public.weekly_align_notes FOR INSERT
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR current_user_has_sensitive_access('strategic'::text)
);

CREATE POLICY "Owners admins and strategic can update weekly notes"
ON public.weekly_align_notes FOR UPDATE
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR current_user_has_sensitive_access('strategic'::text)
);

CREATE POLICY "Owners and admins can delete weekly notes"
ON public.weekly_align_notes FOR DELETE
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
);