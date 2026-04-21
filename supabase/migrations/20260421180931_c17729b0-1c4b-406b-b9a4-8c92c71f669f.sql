
-- ============================================================
-- 1) PORTAIS — remover acesso anon directo, manter via SECURITY DEFINER funcs
-- ============================================================

-- Helper para validar token activo
CREATE OR REPLACE FUNCTION public.portal_token_active(_token uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_portals WHERE token = _token AND is_active = true)
$$;

-- portal_initial_questions
DROP POLICY IF EXISTS "Portal questions publicly readable" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Portal questions publicly answerable" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Anon can view portal questions" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Anon can update portal questions" ON public.portal_initial_questions;

-- portal_monthly_summaries
DROP POLICY IF EXISTS "Portal monthly summaries publicly readable" ON public.portal_monthly_summaries;
DROP POLICY IF EXISTS "Anon can view portal monthly summaries" ON public.portal_monthly_summaries;

-- portal_timeline_phases
DROP POLICY IF EXISTS "Portal timeline phases publicly readable" ON public.portal_timeline_phases;
DROP POLICY IF EXISTS "Anon can view portal timeline phases" ON public.portal_timeline_phases;

-- portal_project_history
DROP POLICY IF EXISTS "Portal project history publicly readable" ON public.portal_project_history;
DROP POLICY IF EXISTS "Anon can view portal project history" ON public.portal_project_history;

-- portal_materials
DROP POLICY IF EXISTS "Portal materials publicly readable" ON public.portal_materials;
DROP POLICY IF EXISTS "Anon can view portal materials" ON public.portal_materials;

-- portal_faqs
DROP POLICY IF EXISTS "Portal FAQs publicly readable" ON public.portal_faqs;
DROP POLICY IF EXISTS "Anon can view portal faqs" ON public.portal_faqs;

-- portal_comments
DROP POLICY IF EXISTS "Portal comments publicly readable" ON public.portal_comments;
DROP POLICY IF EXISTS "Portal comments publicly insertable" ON public.portal_comments;
DROP POLICY IF EXISTS "Anon can view portal comments" ON public.portal_comments;
DROP POLICY IF EXISTS "Anon can insert portal comments" ON public.portal_comments;

-- portal_feedback
DROP POLICY IF EXISTS "Portal feedback publicly readable" ON public.portal_feedback;
DROP POLICY IF EXISTS "Anon can view portal feedback" ON public.portal_feedback;

-- (Authenticated team members continuam com policies USING(true) já existentes — não tocamos.)

-- Funções SECURITY DEFINER para anon aceder via token
CREATE OR REPLACE FUNCTION public.get_portal_initial_questions(_token uuid)
RETURNS SETOF public.portal_initial_questions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.* FROM public.portal_initial_questions q
  JOIN public.client_portals cp ON cp.id = q.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.portal_answer_initial_question(_token uuid, _question_id uuid, _answer text, _file_urls jsonb DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal_id uuid;
BEGIN
  SELECT id INTO _portal_id FROM public.client_portals WHERE token = _token AND is_active = true;
  IF _portal_id IS NULL THEN RETURN false; END IF;
  UPDATE public.portal_initial_questions
  SET answer = _answer,
      file_urls = COALESCE(_file_urls::text, file_urls),
      answered_at = COALESCE(answered_at, now())
  WHERE id = _question_id AND portal_id = _portal_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.get_portal_monthly_summaries(_token uuid)
RETURNS SETOF public.portal_monthly_summaries
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM public.portal_monthly_summaries s
  JOIN public.client_portals cp ON cp.id = s.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.get_portal_timeline_phases(_token uuid)
RETURNS SETOF public.portal_timeline_phases
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.portal_timeline_phases p
  JOIN public.client_portals cp ON cp.id = p.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.get_portal_materials(_token uuid)
RETURNS SETOF public.portal_materials
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.* FROM public.portal_materials m
  JOIN public.client_portals cp ON cp.id = m.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.get_portal_faqs(_token uuid)
RETURNS SETOF public.portal_faqs
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.* FROM public.portal_faqs f
  JOIN public.client_portals cp ON cp.id = f.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.get_portal_comments(_token uuid)
RETURNS SETOF public.portal_comments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.* FROM public.portal_comments c
  JOIN public.client_portals cp ON cp.id = c.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.portal_add_comment(_token uuid, _author text, _content text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal_id uuid; _id uuid;
BEGIN
  SELECT id INTO _portal_id FROM public.client_portals WHERE token = _token AND is_active = true;
  IF _portal_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.portal_comments (portal_id, author, content)
  VALUES (_portal_id, _author, _content)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.get_portal_feedback(_token uuid)
RETURNS SETOF public.portal_feedback
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.* FROM public.portal_feedback f
  JOIN public.client_portals cp ON cp.id = f.portal_id
  WHERE cp.token = _token AND cp.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.portal_submit_feedback(_token uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal_id uuid; _id uuid;
BEGIN
  SELECT id INTO _portal_id FROM public.client_portals WHERE token = _token AND is_active = true;
  IF _portal_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.portal_feedback (portal_id, payload)
  VALUES (_portal_id, _payload)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.portal_token_active(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_initial_questions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_answer_initial_question(uuid, uuid, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_monthly_summaries(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_timeline_phases(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_materials(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_faqs(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_comments(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_add_comment(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_feedback(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_submit_feedback(uuid, jsonb) TO anon, authenticated;

-- ============================================================
-- 2) client_portals — remover update anon arbitrário (já existe RPC portal_record_visit)
-- ============================================================
DROP POLICY IF EXISTS "Portal last_visit updatable by anon" ON public.client_portals;
DROP POLICY IF EXISTS "Anon can update portal last visit" ON public.client_portals;

-- ============================================================
-- 3) member_sensitive_access — só owner pode escrever
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated users can update sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated users can delete sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated insert sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated update sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated delete sensitive access" ON public.member_sensitive_access;

-- (Owner-only policies já existem.)
-- Garantir que existem caso tenham sido removidas:
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_sensitive_access' AND cmd='INSERT') THEN
    EXECUTE 'CREATE POLICY "Owners insert sensitive access" ON public.member_sensitive_access FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''owner''::app_role))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_sensitive_access' AND cmd='UPDATE') THEN
    EXECUTE 'CREATE POLICY "Owners update sensitive access" ON public.member_sensitive_access FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''owner''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''owner''::app_role))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='member_sensitive_access' AND cmd='DELETE') THEN
    EXECUTE 'CREATE POLICY "Owners delete sensitive access" ON public.member_sensitive_access FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''owner''::app_role))';
  END IF;
END $$;

-- ============================================================
-- 4) Storage buckets — financial-files e library-files privados
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id IN ('financial-files', 'library-files');

DROP POLICY IF EXISTS "Public can view financial-files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view library-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view financial-files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view library-files" ON storage.objects;

CREATE POLICY "Authenticated read financial-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'financial-files');

CREATE POLICY "Authenticated write financial-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financial-files');

CREATE POLICY "Authenticated update financial-files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'financial-files');

CREATE POLICY "Authenticated delete financial-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'financial-files');

CREATE POLICY "Authenticated read library-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'library-files');

CREATE POLICY "Authenticated write library-files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-files');

CREATE POLICY "Authenticated update library-files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library-files');

CREATE POLICY "Authenticated delete library-files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'library-files');
