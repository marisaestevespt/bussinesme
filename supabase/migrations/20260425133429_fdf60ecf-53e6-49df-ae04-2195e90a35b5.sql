
DROP VIEW IF EXISTS public.profiles_public CASCADE;

CREATE OR REPLACE FUNCTION public.get_profiles_basic()
RETURNS TABLE(id uuid, user_id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, user_id, full_name, avatar_url
  FROM public.profiles
  WHERE auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_basic() TO authenticated;
