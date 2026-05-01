-- 1) CHECK em team_members.status
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('ativo','inativo'));

-- 2) Proteção: não permitir apagar o último Owner
CREATE OR REPLACE FUNCTION public.prevent_last_owner_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  remaining_owners INT;
BEGIN
  IF OLD.role = 'owner' THEN
    SELECT COUNT(*) INTO remaining_owners
    FROM public.user_roles
    WHERE role = 'owner' AND user_id != OLD.user_id;
    
    IF remaining_owners = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last Owner. Promote another user to Owner first.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_delete ON public.user_roles;
CREATE TRIGGER trg_prevent_last_owner_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_delete();

-- 3) Auto-fix: garantir profile sempre que se atribui role
CREATE OR REPLACE FUNCTION public.ensure_profile_on_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.user_id) THEN
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.user_id, COALESCE(v_email, 'Utilizador'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_on_role ON public.user_roles;
CREATE TRIGGER trg_ensure_profile_on_role
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_on_role();

-- 4) Limpar utilizador fantasma teste@lyrata.pt
DELETE FROM auth.users WHERE email = 'teste@lyrata.pt';