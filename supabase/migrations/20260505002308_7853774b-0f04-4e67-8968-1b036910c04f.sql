
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_authenticated" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can insert clients" ON public.clients;

CREATE POLICY "clients_insert_scoped"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR current_user_has_sensitive_access('clients')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.profile_id
    JOIN public.role_permissions rp ON rp.custom_role_id = tm.custom_role_id
    WHERE p.user_id = auth.uid()
      AND rp.module_key IN ('clientes', 'comercial')
      AND rp.can_view = true
  )
);

DROP POLICY IF EXISTS "commercial_sales_insert" ON public.commercial_sales;
DROP POLICY IF EXISTS "commercial_sales_insert_authenticated" ON public.commercial_sales;
DROP POLICY IF EXISTS "Authenticated can insert commercial_sales" ON public.commercial_sales;

CREATE POLICY "commercial_sales_insert_scoped"
ON public.commercial_sales
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR current_user_has_sensitive_access('financial_values')
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.profile_id
    JOIN public.role_permissions rp ON rp.custom_role_id = tm.custom_role_id
    WHERE p.user_id = auth.uid()
      AND rp.module_key IN ('comercial', 'financeiro')
      AND rp.can_view = true
  )
);

DROP POLICY IF EXISTS "portal_uploads_scoped_read" ON storage.objects;
DROP POLICY IF EXISTS "portal_uploads_scoped_read_by_token" ON storage.objects;

CREATE POLICY "portal_uploads_scoped_read_by_token"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'portal-uploads'
  AND EXISTS (
    SELECT 1
    FROM public.client_portals cp
    WHERE cp.token::text = (storage.foldername(name))[1]
      AND cp.is_active = true
      AND public.user_can_access_client(cp.client_id)
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages';
    EXECUTE $p$CREATE POLICY "realtime_authenticated_only" ON realtime.messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)$p$;
  END IF;
END$$;
