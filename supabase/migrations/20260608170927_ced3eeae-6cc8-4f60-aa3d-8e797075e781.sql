CREATE OR REPLACE FUNCTION public.get_portal_payment_file_path(
  _token uuid, _sale_id uuid, _file_url text
) RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match boolean;
  v_path text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portals cp
    JOIN public.clients c ON c.id = cp.client_id
    JOIN public.commercial_sales cs ON cs.client = c.full_name
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cs.documents::jsonb, '[]'::jsonb)) AS doc
    WHERE cp.token = _token
      AND cp.is_active = true
      AND cs.id = _sale_id
      AND doc->>'url' = _file_url
  ) INTO v_match;

  IF NOT v_match THEN RETURN NULL; END IF;

  -- Extract storage path: everything after the bucket name in the URL
  v_path := regexp_replace(_file_url, '^.*/financial-files/', '');
  IF v_path = _file_url OR v_path = '' THEN RETURN NULL; END IF;

  RETURN v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_payment_file_path(uuid, uuid, text) TO anon, authenticated, service_role;