
-- Allow service_role to read system_config (already bypasses RLS, but also allow
-- the edge function's anon client to read the encryption key via a specific function)
CREATE OR REPLACE FUNCTION public.get_system_config_value(_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT value FROM public.system_config WHERE key = _key LIMIT 1;
$$;
