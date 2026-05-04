
-- ===== Helper: check access via portal_id =====
CREATE OR REPLACE FUNCTION public.user_can_access_portal(_portal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin_or_owner()
      OR EXISTS (
        SELECT 1 FROM public.client_portals cp
        WHERE cp.id = _portal_id
          AND public.user_can_access_client(cp.client_id)
      );
$$;
REVOKE EXECUTE ON FUNCTION public.user_can_access_portal(uuid) FROM anon;

-- ===== Portal tables =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'portal_comments','portal_faqs','portal_feedback','portal_initial_questions',
    'portal_monthly_summaries','portal_project_history','portal_timeline_phases'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage portal comments" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage portal FAQs" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage portal feedback" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can read portal feedback" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage portal questions" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage monthly summaries" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage timeline phases" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can view portal_project_history" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Operacao can insert portal_project_history" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Operacao can update portal_project_history" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Operacao can delete portal_project_history" ON public.%I', t);

    EXECUTE format('CREATE POLICY "Portal access scoped select" ON public.%I FOR SELECT TO authenticated USING (public.user_can_access_portal(portal_id))', t);
    EXECUTE format('CREATE POLICY "Portal access scoped insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_can_access_portal(portal_id))', t);
    EXECUTE format('CREATE POLICY "Portal access scoped update" ON public.%I FOR UPDATE TO authenticated USING (public.user_can_access_portal(portal_id)) WITH CHECK (public.user_can_access_portal(portal_id))', t);
    EXECUTE format('CREATE POLICY "Portal access scoped delete" ON public.%I FOR DELETE TO authenticated USING (public.user_can_access_portal(portal_id))', t);
  END LOOP;
END $$;

-- ===== Client-scoped tables =====
DROP POLICY IF EXISTS "Authenticated users can manage client NPS records" ON public.client_nps_records;
DROP POLICY IF EXISTS "Authenticated users can manage client milestones" ON public.client_milestones;
DROP POLICY IF EXISTS "auth manage client_feedback" ON public.client_feedback;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_nps_records','client_milestones','client_feedback'] LOOP
    EXECUTE format('CREATE POLICY "Client access scoped select" ON public.%I FOR SELECT TO authenticated USING (public.user_can_access_client(client_id))', t);
    EXECUTE format('CREATE POLICY "Client access scoped insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.user_can_access_client(client_id))', t);
    EXECUTE format('CREATE POLICY "Client access scoped update" ON public.%I FOR UPDATE TO authenticated USING (public.user_can_access_client(client_id)) WITH CHECK (public.user_can_access_client(client_id))', t);
    EXECUTE format('CREATE POLICY "Client access scoped delete" ON public.%I FOR DELETE TO authenticated USING (public.user_can_access_client(client_id))', t);
  END LOOP;
END $$;

-- ===== Remove sensitive tables from realtime broadcast =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'portal_comments','portal_faqs','portal_feedback','portal_initial_questions',
    'portal_monthly_summaries','portal_project_history','portal_timeline_phases',
    'client_assignments','client_feedback'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
