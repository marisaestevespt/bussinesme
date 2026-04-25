-- ============================================================
-- 1. Remover políticas SELECT permissivas duplicadas
-- ============================================================
DROP POLICY IF EXISTS "Authenticated views business_setup" ON public.business_setup;
DROP POLICY IF EXISTS "Authenticated views client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can view crm leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can view performance_weekly" ON public.performance_weekly;

-- ============================================================
-- 2. Corrigir tm_select: remover o OR auth.uid() IS NOT NULL
--    que tornava a política equivalente a "true"
-- ============================================================
DROP POLICY IF EXISTS "tm_select" ON public.team_members;
CREATE POLICY "tm_select"
  ON public.team_members FOR SELECT
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR public.user_in_department('recursos-humanos'::text)
    OR public.is_self_team_member(id)
  );

-- ============================================================
-- 3. performance_weekly: alinhar com performance_monthly
-- ============================================================
CREATE POLICY "perf_weekly_select"
  ON public.performance_weekly FOR SELECT
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.id = performance_weekly.member_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. financial_goals: separar leitura/escrita
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage financial goals" ON public.financial_goals;

CREATE POLICY "fg_select"
  ON public.financial_goals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "fg_write"
  ON public.financial_goals FOR ALL
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('financeiro'::text)
  )
  WITH CHECK (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('financeiro'::text)
  );

-- ============================================================
-- 5. time_entries: cada membro só os seus; owner/admin/RH veem todos
-- ============================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.time_entries;

CREATE POLICY "te_select"
  ON public.time_entries FOR SELECT
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.id = time_entries.member_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "te_insert"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.id = time_entries.member_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "te_update"
  ON public.time_entries FOR UPDATE
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.id = time_entries.member_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "te_delete"
  ON public.time_entries FOR DELETE
  USING (
    public.is_owner()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.id = time_entries.member_id AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. portal-uploads: restringir leitura a quem está associado ao cliente
--    Convenção do bucket: ficheiros guardados como "<client_id>/..."
-- ============================================================
DROP POLICY IF EXISTS "portal_uploads_internal_read" ON storage.objects;

CREATE POLICY "portal_uploads_scoped_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'portal-uploads'
    AND (
      public.is_admin_or_owner()
      OR public.user_can_access_client(((storage.foldername(name))[1])::uuid)
    )
  );