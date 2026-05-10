-- 1) Tighten iva_payments permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert iva payments" ON public.iva_payments;
DROP POLICY IF EXISTS "Authenticated users can update iva payments" ON public.iva_payments;
DROP POLICY IF EXISTS "Authenticated users can delete iva payments" ON public.iva_payments;

CREATE POLICY "Admin/Owner can insert iva payments"
ON public.iva_payments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin/Owner can update iva payments"
ON public.iva_payments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin/Owner can delete iva payments"
ON public.iva_payments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- 2) Revoke anon EXECUTE on internal SECURITY DEFINER functions.
-- Keep anon access ONLY for public portal entrypoints (get_portal_*, portal_*).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, p.proname AS fn,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT LIKE 'get_portal_%'
      AND p.proname NOT LIKE 'portal_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public',
                   r.fn, r.args);
  END LOOP;
END $$;