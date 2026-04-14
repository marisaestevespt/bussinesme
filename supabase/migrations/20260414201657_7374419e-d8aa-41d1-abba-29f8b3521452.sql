
-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;

-- Remove ALL insert policies on audit_logs
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'audit_logs' AND schemaname = 'public' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', pol.policyname);
  END LOOP;
END $$;

-- Create security definer function for validated audit logging
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  _action text,
  _entity_type text,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _user_name text;
  _allowed_actions text[] := ARRAY['created','updated','deleted','archived','restored','login','exported','sent_email','status_change'];
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  -- Validate action
  IF _action IS NULL OR NOT (_action = ANY(_allowed_actions)) THEN
    RETURN;
  END IF;

  -- Validate entity_type is not empty
  IF _entity_type IS NULL OR btrim(_entity_type) = '' THEN
    RETURN;
  END IF;

  -- Get user name
  SELECT full_name INTO _user_name
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1;

  INSERT INTO public.audit_logs (user_id, user_name, action, entity_type, entity_id, metadata)
  VALUES (_user_id, _user_name, _action, _entity_type, _entity_id, _metadata);
END;
$$;
