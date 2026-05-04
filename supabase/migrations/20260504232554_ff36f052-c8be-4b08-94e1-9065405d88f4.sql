DO $$
DECLARE
  tbl text;
  tables_to_remove text[] := ARRAY[
    'portal_visits',
    'weekly_align_notes',
    'edge_function_runs',
    'monthly_reports',
    'role_activity_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_remove LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = 'public'
        AND c.relname = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated can insert fin documents" ON public.financial_documents;
CREATE POLICY "Finance roles can insert financial documents"
ON public.financial_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_owner()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'accountant'::public.app_role) AND public.accountant_access_enabled())
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);

DROP POLICY IF EXISTS "Authenticated can insert contractors" ON public.financial_contractors;
CREATE POLICY "Finance and HR roles can insert contractors"
ON public.financial_contractors
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_owner()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin_staff'::public.app_role)
  OR (public.has_role(auth.uid(), 'accountant'::public.app_role) AND public.accountant_access_enabled())
  OR public.has_role(auth.uid(), 'hr'::public.app_role)
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);