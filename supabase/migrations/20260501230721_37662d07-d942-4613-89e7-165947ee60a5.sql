-- ============ L8: OPERATION & METRICS HARDENING ============

CREATE OR REPLACE FUNCTION public.can_edit_operational_kpis()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR public.user_in_department('operacao')
$$;

CREATE OR REPLACE FUNCTION public.can_edit_marketing_metrics()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR public.user_in_department('marketing')
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kpi_settings','objective_metrics','product_kpis','product_kpi_values','product_kpi_reports','product_metrics_analysis']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth manage %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %1$s" ON public.%1$s', t);

    EXECUTE format('CREATE POLICY "Authenticated can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Operacao can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.can_edit_operational_kpis())', t);
    EXECUTE format('CREATE POLICY "Operacao can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.can_edit_operational_kpis()) WITH CHECK (public.can_edit_operational_kpis())', t);
    EXECUTE format('CREATE POLICY "Operacao can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.can_edit_operational_kpis())', t);
  END LOOP;
END$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['channel_monthly_metrics','content_metrics']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can insert %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can update %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can delete %1$s" ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can view %1$s" ON public.%1$s', t);

    EXECUTE format('CREATE POLICY "Authenticated can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Marketing can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.can_edit_marketing_metrics())', t);
    EXECUTE format('CREATE POLICY "Marketing can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.can_edit_marketing_metrics()) WITH CHECK (public.can_edit_marketing_metrics())', t);
    EXECUTE format('CREATE POLICY "Marketing can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.can_edit_marketing_metrics())', t);
  END LOOP;
END$$;