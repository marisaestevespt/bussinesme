CREATE OR REPLACE FUNCTION public.auto_assign_meeting_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _profile_id uuid;
  _user_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT account_manager_id INTO _user_id FROM public.clients WHERE id = NEW.client_id;
    IF _user_id IS NOT NULL THEN
      SELECT id INTO _profile_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
    END IF;
  END IF;

  IF _profile_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT profile_id INTO _profile_id
    FROM public.project_members WHERE project_id = NEW.project_id
    ORDER BY created_at LIMIT 1;
  END IF;

  IF _profile_id IS NULL THEN
    SELECT p.id INTO _profile_id
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE ur.role = 'owner'
    ORDER BY p.created_at LIMIT 1;
  END IF;

  IF _profile_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT id INTO _profile_id FROM public.profiles WHERE user_id = NEW.created_by LIMIT 1;
  END IF;

  IF _profile_id IS NOT NULL THEN
    INSERT INTO public.meeting_participants (meeting_id, profile_id)
    VALUES (NEW.id, _profile_id)
    ON CONFLICT (meeting_id, profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;