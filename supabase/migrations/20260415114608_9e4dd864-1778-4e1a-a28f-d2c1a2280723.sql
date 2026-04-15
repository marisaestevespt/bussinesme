-- Security definer function to record portal visit (updates last_visit_at)
CREATE OR REPLACE FUNCTION public.portal_record_visit(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.client_portals
  SET last_visit_at = now()
  WHERE token = _token AND is_active = true;
END;
$$;