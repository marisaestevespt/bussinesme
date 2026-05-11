
-- 1) Direct client requests sent from the portal
CREATE TABLE IF NOT EXISTS public.client_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_curso','resolvido')),
  source text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','team')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_requests_client ON public.client_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON public.client_requests(status);

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view client requests"
  ON public.client_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage client requests"
  ON public.client_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Collaborative meeting preparation items
CREATE TABLE IF NOT EXISTS public.meeting_prep_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'team' CHECK (source IN ('portal','team')),
  author_label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_prep_items_meeting ON public.meeting_prep_items(meeting_id);

ALTER TABLE public.meeting_prep_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view meeting prep items"
  ON public.meeting_prep_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage meeting prep items"
  ON public.meeting_prep_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) Portal RPCs
-- List requests for portal
CREATE OR REPLACE FUNCTION public.get_portal_client_requests(_token uuid)
RETURNS TABLE (
  id uuid, title text, message text, status text, source text,
  resolved_at timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.title, r.message, r.status, r.source, r.resolved_at, r.created_at
  FROM public.client_requests r
  JOIN public.client_portals cp ON cp.client_id = r.client_id
  WHERE cp.token = _token AND cp.is_active = true
  ORDER BY r.created_at DESC;
$$;

-- Create a new request from portal
CREATE OR REPLACE FUNCTION public.portal_create_client_request(
  _token uuid, _title text, _message text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client_id uuid; _new_id uuid;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true LIMIT 1;
  IF _client_id IS NULL THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'title_required'; END IF;

  INSERT INTO public.client_requests (client_id, title, message, source, status)
  VALUES (_client_id, trim(_title), nullif(trim(_message),''), 'portal', 'novo')
  RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$$;

-- List meeting prep items for portal (only meetings of this client and visible)
CREATE OR REPLACE FUNCTION public.get_portal_meeting_prep_items(_token uuid, _meeting_id uuid)
RETURNS TABLE (
  id uuid, content text, source text, author_label text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mp.id, mp.content, mp.source, mp.author_label, mp.created_at
  FROM public.meeting_prep_items mp
  JOIN public.meetings m ON m.id = mp.meeting_id
  JOIN public.client_portals cp ON cp.client_id = m.client_id
  WHERE cp.token = _token AND cp.is_active = true
    AND m.id = _meeting_id AND m.visible_in_portal = true
  ORDER BY mp.created_at ASC;
$$;

-- Add a meeting prep item from portal
CREATE OR REPLACE FUNCTION public.portal_add_meeting_prep_item(
  _token uuid, _meeting_id uuid, _content text, _author_label text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean; _new_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.client_portals cp
    JOIN public.meetings m ON m.client_id = cp.client_id
    WHERE cp.token = _token AND cp.is_active = true
      AND m.id = _meeting_id AND m.visible_in_portal = true
  ) INTO _ok;
  IF NOT _ok THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(trim(_content),'') = '' THEN RAISE EXCEPTION 'content_required'; END IF;

  INSERT INTO public.meeting_prep_items (meeting_id, content, source, author_label)
  VALUES (_meeting_id, trim(_content), 'portal', nullif(trim(_author_label),''))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$$;

-- Delete only own portal item (within last 24h, optional safeguard)
CREATE OR REPLACE FUNCTION public.portal_delete_meeting_prep_item(
  _token uuid, _item_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.meeting_prep_items mp
    JOIN public.meetings m ON m.id = mp.meeting_id
    JOIN public.client_portals cp ON cp.client_id = m.client_id
    WHERE cp.token = _token AND cp.is_active = true
      AND mp.id = _item_id AND mp.source = 'portal'
  ) INTO _ok;
  IF NOT _ok THEN RETURN false; END IF;
  DELETE FROM public.meeting_prep_items WHERE id = _item_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_client_requests(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_create_client_request(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_meeting_prep_items(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_add_meeting_prep_item(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_delete_meeting_prep_item(uuid, uuid) TO anon, authenticated;
