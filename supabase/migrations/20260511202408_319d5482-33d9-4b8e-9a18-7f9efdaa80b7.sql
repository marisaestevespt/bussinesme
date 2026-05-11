ALTER TABLE public.portal_feedback
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS team_response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid;

ALTER TABLE public.portal_feedback
  DROP CONSTRAINT IF EXISTS portal_feedback_category_check;
ALTER TABLE public.portal_feedback
  ADD CONSTRAINT portal_feedback_category_check
  CHECK (category IN ('elogio','sugestao','problema','outro'));

ALTER TABLE public.client_nps_records
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'team';

ALTER TABLE public.client_nps_records
  DROP CONSTRAINT IF EXISTS client_nps_records_source_check;
ALTER TABLE public.client_nps_records
  ADD CONSTRAINT client_nps_records_source_check
  CHECK (source IN ('team','portal'));

CREATE OR REPLACE FUNCTION public.portal_submit_feedback(_token uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _portal_id uuid;
  _id uuid;
  _content text;
  _category text;
BEGIN
  SELECT id INTO _portal_id
  FROM public.client_portals
  WHERE token = _token AND is_active = true;

  IF _portal_id IS NULL THEN RETURN NULL; END IF;

  _content  := COALESCE(NULLIF(trim(_payload->>'content'), ''), NULL);
  _category := COALESCE(NULLIF(_payload->>'category', ''), 'outro');

  IF _content IS NULL THEN RETURN NULL; END IF;
  IF _category NOT IN ('elogio','sugestao','problema','outro') THEN
    _category := 'outro';
  END IF;

  INSERT INTO public.portal_feedback (portal_id, content, category)
  VALUES (_portal_id, _content, _category)
  RETURNING id INTO _id;

  RETURN _id;
END $$;

DROP FUNCTION IF EXISTS public.get_portal_feedback(uuid);
CREATE FUNCTION public.get_portal_feedback(_token uuid)
RETURNS TABLE (
  id uuid,
  content text,
  category text,
  team_response text,
  responded_at timestamptz,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _portal_id uuid;
BEGIN
  SELECT cp.id INTO _portal_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _portal_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT pf.id, pf.content, pf.category, pf.team_response, pf.responded_at, pf.submitted_at
  FROM public.portal_feedback pf
  WHERE pf.portal_id = _portal_id
  ORDER BY pf.submitted_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.portal_get_pending_nps(_token uuid)
RETURNS TABLE (
  id uuid,
  expected_date date,
  product_id uuid,
  product_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _client_id uuid;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT n.id, n.expected_date, n.product_id, p.name
  FROM public.client_nps_records n
  LEFT JOIN public.products p ON p.id = n.product_id
  WHERE n.client_id = _client_id
    AND n.status = 'por_fazer'
    AND n.expected_date <= CURRENT_DATE
  ORDER BY n.expected_date ASC;
END $$;

CREATE OR REPLACE FUNCTION public.portal_get_nps_history(_token uuid)
RETURNS TABLE (
  id uuid,
  nps_score integer,
  notes text,
  actual_date date,
  source text,
  product_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _client_id uuid;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT n.id, n.nps_score, n.notes, n.actual_date, n.source, p.name
  FROM public.client_nps_records n
  LEFT JOIN public.products p ON p.id = n.product_id
  WHERE n.client_id = _client_id
    AND n.status = 'concluido'
    AND n.nps_score IS NOT NULL
  ORDER BY n.actual_date DESC NULLS LAST
  LIMIT 20;
END $$;

CREATE OR REPLACE FUNCTION public.portal_submit_nps(
  _token uuid,
  _record_id uuid,
  _score integer,
  _notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _client_id uuid;
BEGIN
  IF _score < 0 OR _score > 10 THEN RETURN false; END IF;

  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN false; END IF;

  UPDATE public.client_nps_records
  SET nps_score = _score,
      notes = COALESCE(NULLIF(trim(_notes), ''), notes),
      status = 'concluido',
      actual_date = CURRENT_DATE,
      source = 'portal',
      updated_at = now()
  WHERE id = _record_id
    AND client_id = _client_id
    AND status = 'por_fazer';

  RETURN FOUND;
END $$;