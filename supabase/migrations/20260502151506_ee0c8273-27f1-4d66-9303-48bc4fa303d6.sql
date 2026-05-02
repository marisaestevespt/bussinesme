-- Allow the auto-link from public.handle_new_user to set profile_id on team_members
-- without being blocked by protect_team_members_sensitive_fields.
-- Detection: the only legitimate transition from NULL -> non-NULL profile_id
-- happens during signup via the SECURITY DEFINER handle_new_user trigger.
CREATE OR REPLACE FUNCTION public.protect_team_members_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_priv boolean;
  _is_signup_link boolean;
BEGIN
  _is_priv := public.is_admin_or_owner();

  IF _is_priv THEN
    RETURN NEW;
  END IF;

  -- Allow the signup auto-link: the only fields changing are profile_id
  -- (from NULL to a value), set by the SECURITY DEFINER handle_new_user trigger.
  _is_signup_link :=
    OLD.profile_id IS NULL
    AND NEW.profile_id IS NOT NULL
    AND NEW.custom_role_id IS NOT DISTINCT FROM OLD.custom_role_id
    AND NEW.department IS NOT DISTINCT FROM OLD.department
    AND NEW.departments IS NOT DISTINCT FROM OLD.departments
    AND NEW.access_suspended IS NOT DISTINCT FROM OLD.access_suspended
    AND NEW.access_revoked IS NOT DISTINCT FROM OLD.access_revoked
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.hourly_cost IS NOT DISTINCT FROM OLD.hourly_cost
    AND NEW.settlement_value IS NOT DISTINCT FROM OLD.settlement_value
    AND NEW.settlement_date IS NOT DISTINCT FROM OLD.settlement_date
    AND NEW.settlement_notes IS NOT DISTINCT FROM OLD.settlement_notes
    AND NEW.role_title IS NOT DISTINCT FROM OLD.role_title
    AND NEW.work_areas IS NOT DISTINCT FROM OLD.work_areas
    AND NEW.email IS NOT DISTINCT FROM OLD.email
    AND NEW.inactivated_at IS NOT DISTINCT FROM OLD.inactivated_at;

  IF _is_signup_link THEN
    RETURN NEW;
  END IF;

  IF NEW.custom_role_id IS DISTINCT FROM OLD.custom_role_id
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.departments IS DISTINCT FROM OLD.departments
     OR NEW.access_suspended IS DISTINCT FROM OLD.access_suspended
     OR NEW.access_revoked IS DISTINCT FROM OLD.access_revoked
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.hourly_cost IS DISTINCT FROM OLD.hourly_cost
     OR NEW.settlement_value IS DISTINCT FROM OLD.settlement_value
     OR NEW.settlement_date IS DISTINCT FROM OLD.settlement_date
     OR NEW.settlement_notes IS DISTINCT FROM OLD.settlement_notes
     OR NEW.role_title IS DISTINCT FROM OLD.role_title
     OR NEW.work_areas IS DISTINCT FROM OLD.work_areas
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.inactivated_at IS DISTINCT FROM OLD.inactivated_at
  THEN
    RAISE EXCEPTION 'Não tens permissão para alterar campos sensíveis do teu perfil de equipa.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;