DROP POLICY IF EXISTS "Authenticated users can insert competitors" ON public.product_competitors;
DROP POLICY IF EXISTS "Authenticated users can update competitors" ON public.product_competitors;
DROP POLICY IF EXISTS "Authenticated users can delete competitors" ON public.product_competitors;

CREATE POLICY "Team members can insert competitors"
  ON public.product_competitors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can update competitors"
  ON public.product_competitors FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can delete competitors"
  ON public.product_competitors FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);