-- Internal helper functions: revoke anon EXECUTE, keep authenticated.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'accountant_access_enabled()',
    'current_team_member_id()',
    'current_user_departments()',
    'current_user_has_sensitive_access(text)',
    'current_user_is_suspended()',
    'has_role(uuid, app_role)',
    'has_any_role(uuid, app_role[])',
    'is_admin_or_owner()',
    'is_owner()',
    'is_self_team_member(uuid)',
    'user_can_access_client(uuid)',
    'user_can_access_project(uuid)',
    'resolve_deliverable_assignee(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, public', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- skip if signature differs in this project
      NULL;
    END;
  END LOOP;
END $$;
