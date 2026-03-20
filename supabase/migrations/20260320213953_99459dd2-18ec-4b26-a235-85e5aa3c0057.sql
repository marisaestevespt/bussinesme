
CREATE OR REPLACE FUNCTION public.get_portal_payments(_token uuid)
RETURNS TABLE (
  id uuid,
  sale_month integer,
  payment_date text,
  documents jsonb,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.id, cs.sale_month, cs.payment_date, cs.documents::jsonb, cs.status
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.commercial_sales cs ON cs.client = c.full_name
  WHERE cp.token = _token
    AND cp.is_active = true
  ORDER BY cs.payment_date ASC NULLS LAST
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_payments(uuid) TO anon, authenticated;
