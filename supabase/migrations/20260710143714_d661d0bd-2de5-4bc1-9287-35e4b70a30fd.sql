
-- 1) Restrict business_settings SELECT to authenticated users that actually have a role assigned (team members)
DROP POLICY IF EXISTS "Authenticated can read business settings" ON public.business_settings;
CREATE POLICY "Team members can read business settings"
ON public.business_settings
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- 2) Remove the exploitable owner-bootstrap RLS policy and replace with a SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Allow first owner bootstrap" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.claim_first_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Only allow when there are ZERO rows in user_roles (first-run bootstrap only).
  IF EXISTS (SELECT 1 FROM public.user_roles) THEN
    RAISE EXCEPTION 'owner_already_exists';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'owner');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_owner() TO authenticated;
