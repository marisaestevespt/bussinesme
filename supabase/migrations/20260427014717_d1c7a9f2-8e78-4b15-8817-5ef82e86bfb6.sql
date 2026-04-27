-- Improve handle_new_user trigger: auto-link team_member + assign role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _profile_id uuid;
  _member record;
  _role public.app_role;
BEGIN
  -- 1. Create profile (existing behaviour)
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  RETURNING id INTO _profile_id;

  -- 2. Find matching team_member by email (case-insensitive)
  SELECT id, member_type, department, role_title
    INTO _member
  FROM public.team_members
  WHERE lower(email) = lower(NEW.email)
    AND profile_id IS NULL
  LIMIT 1;

  IF _member.id IS NOT NULL THEN
    -- Link profile to team member
    UPDATE public.team_members
    SET profile_id = _profile_id
    WHERE id = _member.id;

    -- Decide role based on member context
    IF _member.department = 'financeiro'
       AND _member.member_type = 'prestador_servicos'
       AND lower(coalesce(_member.role_title, '')) LIKE '%contabil%' THEN
      _role := 'accountant';
    ELSE
      _role := 'member';
    END IF;
  ELSE
    _role := 'member';
  END IF;

  -- 3. Assign role if not already present
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;