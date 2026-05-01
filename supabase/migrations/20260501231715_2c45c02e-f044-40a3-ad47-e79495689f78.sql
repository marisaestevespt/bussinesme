-- ============ L10: STORAGE BUCKETS HARDENING ============

-- Helper (idempotente)
CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
$$;

-- ===== personal-images: remover listing redundante =====
DROP POLICY IF EXISTS "Authenticated can list personal images" ON storage.objects;

-- ===== logos: apertar mutate a Owner/Admin + adicionar DELETE =====
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;

CREATE POLICY "Owner/admin can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.is_admin_or_owner());

CREATE POLICY "Owner/admin can update logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND public.is_admin_or_owner())
  WITH CHECK (bucket_id = 'logos' AND public.is_admin_or_owner());

CREATE POLICY "Owner/admin can delete logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.is_admin_or_owner());

-- ===== custom-fonts: apertar mutate a Owner/Admin =====
DROP POLICY IF EXISTS "Authenticated users can update fonts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete fonts" ON storage.objects;

CREATE POLICY "Owner/admin can update fonts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'custom-fonts' AND public.is_admin_or_owner())
  WITH CHECK (bucket_id = 'custom-fonts' AND public.is_admin_or_owner());

CREATE POLICY "Owner/admin can delete fonts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'custom-fonts' AND public.is_admin_or_owner());

-- ===== entity-icons: apertar mutate a Owner/Admin =====
DROP POLICY IF EXISTS "entity-icons authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "entity-icons authenticated delete" ON storage.objects;

CREATE POLICY "Owner/admin can update entity-icons"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'entity-icons' AND public.is_admin_or_owner())
  WITH CHECK (bucket_id = 'entity-icons' AND public.is_admin_or_owner());

CREATE POLICY "Owner/admin can delete entity-icons"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'entity-icons' AND public.is_admin_or_owner());