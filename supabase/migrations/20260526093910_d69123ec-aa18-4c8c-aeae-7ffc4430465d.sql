
-- Fix 1: Restrict iva_payments SELECT to finance roles (consistent with other financial tables)
DROP POLICY IF EXISTS "Authenticated can view iva_payments" ON public.iva_payments;
DROP POLICY IF EXISTS "All authenticated can view iva_payments" ON public.iva_payments;
DROP POLICY IF EXISTS "iva_payments_select" ON public.iva_payments;
DROP POLICY IF EXISTS "Users can view iva_payments" ON public.iva_payments;
DROP POLICY IF EXISTS "Anyone can view iva_payments" ON public.iva_payments;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='iva_payments' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.iva_payments', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Finance roles can view iva_payments"
ON public.iva_payments
FOR SELECT
TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_in_department('financeiro')
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR current_user_has_sensitive_access('financial_values')
);

-- Fix 2: Tighten realtime topic policy to exact equality match
DROP POLICY IF EXISTS "realtime_topic_scoped_to_user" ON realtime.messages;

CREATE POLICY "realtime_topic_scoped_to_user"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
);
