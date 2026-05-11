-- 1. Fix function with mutable search_path
ALTER FUNCTION public.add_business_hours(timestamptz, integer) SET search_path = public;

-- 2. Revoke EXECUTE from anon (and public) on internal SECURITY DEFINER functions.
--    Portal-facing get_portal_*/portal_* functions stay accessible because they
--    validate the caller via the _token argument. Functions below are either
--    triggers, team-only utilities, or admin diagnostics that must NOT be
--    callable without authentication.
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.auto_assign_deliverable_by_role()',
    'public.handle_client_request_created()',
    'public.handle_meeting_prep_item_created()',
    'public.handle_meeting_scheduled_notify_client()',
    'public.notify_team_users(text, text, text, text, text, uuid)',
    'public.propagate_role_rename_to_work_areas()',
    'public.queue_transactional_email(text, text, text, jsonb)',
    'public.sync_exec_objective_to_dept_goals()',
    'public.sync_planning_to_departmental()',
    'public.sync_team_member_work_areas_from_role()',
    'public.trg_audit_client_request()',
    'public.trg_audit_meeting_prep_item()',
    'public.trg_audit_portal_feedback()',
    'public.get_client_portal_audit(uuid)',
    'public.get_client_portal_health(uuid)'
  ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', fn);
  END LOOP;
END $$;