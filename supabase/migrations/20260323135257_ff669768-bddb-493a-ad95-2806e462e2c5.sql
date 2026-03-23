CREATE POLICY "Authenticated users can delete strategy"
  ON public.commercial_strategy
  FOR DELETE
  TO authenticated
  USING (true);