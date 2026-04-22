DROP POLICY IF EXISTS "Authenticated full access" ON public.time_entries;
CREATE POLICY "Authenticated full access" ON public.time_entries FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage weekly notes" ON public.weekly_align_notes;
CREATE POLICY "Authenticated users can manage weekly notes" ON public.weekly_align_notes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
