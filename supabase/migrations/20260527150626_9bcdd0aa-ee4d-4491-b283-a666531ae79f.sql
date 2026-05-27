
-- 1) Função que sincroniza user_roles 'owner' a partir de team_members.custom_role_id
CREATE OR REPLACE FUNCTION public.sync_owner_role_from_custom_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_is_owner boolean := false;
  _old_is_owner boolean := false;
  _user_id uuid;
  _old_user_id uuid;
BEGIN
  -- Resolve owner-ness of new custom_role
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.custom_role_id IS NOT NULL THEN
    SELECT COALESCE(is_owner,false) INTO _new_is_owner FROM public.custom_roles WHERE id = NEW.custom_role_id;
  END IF;

  -- Resolve owner-ness of old custom_role
  IF TG_OP = 'UPDATE' AND OLD.custom_role_id IS NOT NULL THEN
    SELECT COALESCE(is_owner,false) INTO _old_is_owner FROM public.custom_roles WHERE id = OLD.custom_role_id;
  END IF;

  -- Resolve user_id (auth) from profile_id
  IF NEW.profile_id IS NOT NULL THEN
    SELECT user_id INTO _user_id FROM public.profiles WHERE id = NEW.profile_id;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.profile_id IS NOT NULL THEN
    SELECT user_id INTO _old_user_id FROM public.profiles WHERE id = OLD.profile_id;
  END IF;

  -- Grant: se novo cargo é owner e o membro tem user_id, garante user_roles row
  IF _new_is_owner AND _user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Revoke: se mudou de cargo owner -> não-owner (mesmo user), remove o role
  IF TG_OP = 'UPDATE' AND _old_is_owner AND NOT _new_is_owner AND _old_user_id IS NOT NULL THEN
    -- Só remove se não houver OUTRO team_member do mesmo user com cargo owner
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members tm2
      JOIN public.custom_roles cr2 ON cr2.id = tm2.custom_role_id
      JOIN public.profiles p2 ON p2.id = tm2.profile_id
      WHERE p2.user_id = _old_user_id AND cr2.is_owner = true AND tm2.id <> NEW.id
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = _old_user_id AND role = 'owner';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_owner_role_from_custom_role ON public.team_members;
CREATE TRIGGER trg_sync_owner_role_from_custom_role
AFTER INSERT OR UPDATE OF custom_role_id, profile_id ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.sync_owner_role_from_custom_role();

-- 2) Backfill: para todos os team_members com cargo is_owner=true e que já tenham profile/user, garantir user_roles row
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT p.user_id, 'owner'::app_role
FROM public.team_members tm
JOIN public.custom_roles cr ON cr.id = tm.custom_role_id AND cr.is_owner = true
JOIN public.profiles p ON p.id = tm.profile_id
WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
