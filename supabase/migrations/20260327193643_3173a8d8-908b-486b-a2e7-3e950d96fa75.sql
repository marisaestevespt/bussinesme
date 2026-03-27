CREATE OR REPLACE FUNCTION public.get_portal_payment_methods(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT bs.payment_methods FROM public.business_setup bs LIMIT 1),
    '[]'::jsonb
  )
$$;