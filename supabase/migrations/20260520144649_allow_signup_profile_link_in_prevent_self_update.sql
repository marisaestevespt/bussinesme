-- Fix: handle_new_user (trigger em auth.users) faz
--   UPDATE team_members SET profile_id = ... WHERE email = NEW.email
-- e a função prevent_team_member_sensitive_self_update bloqueia qualquer
-- mudança em profile_id, mesmo quando vem do trigger de signup (sem
-- auth.uid()). Isto fazia o auth.admin.createUser falhar com
-- "Database error creating new user". Adicionamos o mesmo bypass que já
-- existe em protect_team_members_sensitive_fields.

CREATE OR REPLACE FUNCTION public.prevent_team_member_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_signup_link boolean;
BEGIN
  -- Admins/owners podem alterar tudo
  IF public.is_admin_or_owner() THEN
    RETURN NEW;
  END IF;

  -- Permitir o auto-link do signup: a única alteração é profile_id
  -- (de NULL para um valor), feita pelo trigger SECURITY DEFINER
  -- handle_new_user em auth.users.
  _is_signup_link :=
    OLD.profile_id IS NULL
    AND NEW.profile_id IS NOT NULL
    AND NEW.custom_role_id IS NOT DISTINCT FROM OLD.custom_role_id
    AND NEW.access_suspended IS NOT DISTINCT FROM OLD.access_suspended
    AND NEW.hourly_cost IS NOT DISTINCT FROM OLD.hourly_cost
    AND NEW.iban IS NOT DISTINCT FROM OLD.iban
    AND NEW.fiscal_address IS NOT DISTINCT FROM OLD.fiscal_address
    AND NEW.identification IS NOT DISTINCT FROM OLD.identification
    AND NEW.email IS NOT DISTINCT FROM OLD.email
    AND NEW.department IS NOT DISTINCT FROM OLD.department
    AND NEW.role_title IS NOT DISTINCT FROM OLD.role_title
    AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name;

  IF _is_signup_link THEN
    RETURN NEW;
  END IF;

  IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
     OR NEW.access_suspended IS DISTINCT FROM OLD.access_suspended
     OR NEW.hourly_cost IS DISTINCT FROM OLD.hourly_cost
     OR NEW.iban IS DISTINCT FROM OLD.iban
     OR NEW.fiscal_address IS DISTINCT FROM OLD.fiscal_address
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.identification IS DISTINCT FROM OLD.identification
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.role_title IS DISTINCT FROM OLD.role_title
     OR NEW.full_name IS DISTINCT FROM OLD.full_name
  THEN
    RAISE EXCEPTION 'Não tens permissão para alterar campos sensíveis no teu próprio perfil';
  END IF;

  RETURN NEW;
END;
$$;

-- Também remover o trigger duplicado (mesma função aplicada duas vezes)
DROP TRIGGER IF EXISTS trg_protect_team_members_sensitive_fields ON public.team_members;
