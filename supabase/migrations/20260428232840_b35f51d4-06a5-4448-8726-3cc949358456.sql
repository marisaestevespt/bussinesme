CREATE OR REPLACE FUNCTION public.resolve_deliverable_assignee(_deliverable_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _project_id uuid;
  _role text;
  _explicit uuid;
  _assignee uuid;
  _member_count int;
BEGIN
  SELECT project_id, responsible_role, assigned_to
  INTO _project_id, _role, _explicit
  FROM public.project_deliverables
  WHERE id = _deliverable_id;

  IF _explicit IS NOT NULL THEN
    -- tasks.assigned_to is a profile id. If older data accidentally stores auth user_id,
    -- translate it back to the matching profile id.
    SELECT p.id INTO _assignee
    FROM public.profiles p
    WHERE p.user_id = _explicit
    LIMIT 1;

    RETURN COALESCE(_assignee, _explicit);
  END IF;

  IF _role IS NOT NULL THEN
    SELECT pm.profile_id INTO _assignee
    FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.role = _role
    LIMIT 1;
    IF _assignee IS NOT NULL THEN RETURN _assignee; END IF;
  END IF;

  SELECT count(*) INTO _member_count
  FROM public.project_members
  WHERE project_id = _project_id;

  IF _member_count = 1 THEN
    SELECT profile_id INTO _assignee
    FROM public.project_members
    WHERE project_id = _project_id
    LIMIT 1;
    RETURN _assignee;
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.profile_id_to_user_id(_profile_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT p.user_id FROM public.profiles p WHERE p.id = _profile_id LIMIT 1), _profile_id)
$function$;

GRANT EXECUTE ON FUNCTION public.profile_id_to_user_id(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_notification_to_user(_user_id uuid, _type text, _title text, _message text DEFAULT NULL::text, _link text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
  _resolved_user_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _user_id IS NULL OR _type IS NULL OR _title IS NULL THEN
    RAISE EXCEPTION 'missing required fields';
  END IF;
  IF length(_title) > 300 OR length(coalesce(_message,'')) > 2000 OR length(coalesce(_link,'')) > 500 THEN
    RAISE EXCEPTION 'field too long';
  END IF;

  SELECT COALESCE((SELECT p.user_id FROM public.profiles p WHERE p.id = _user_id LIMIT 1), _user_id)
  INTO _resolved_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_resolved_user_id, _type, _title, _message, _link)
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$;

UPDATE public.notifications n
SET user_id = p.user_id
FROM public.profiles p
WHERE n.user_id = p.id;