-- Revoke EXECUTE from `authenticated` on internal SECURITY DEFINER functions.
-- Keep public-callable functions (portal_*, get_portal_*, has_role, has_any_role, is_owner,
-- is_admin_or_owner, is_self_team_member, current_*, accountant_access_enabled,
-- user_can_access_*, log_audit_entry, send_notification_to_user, get_profiles_basic,
-- get_system_config_value, apply_project_deliverable_tasks, backfill_*,
-- activate_renewal_project, cancel_scheduled_renewal, rollback_renewal_project,
-- resolve_deliverable_assignee, enqueue_email, read_email_batch, delete_email, move_to_dlq).
-- Internal functions (triggers, sync_*, cascade_*, log_role_change, notify_*, generate_*,
-- protect_*, audit_*, default_task_assignee, ensure_*, fill_*, cleanup_*, handle_new_user,
-- update_*, sync_has_accountant, log_access_suspension, auto_link_*, sync_meeting_to_*,
-- update_project_progress, sync_renewal_to_task, sync_member_payment_*, sync_deliverable_*,
-- notify_on_repeated_edge_failure, notify_owners_on_sale_insert) are only invoked by
-- triggers or other SECURITY DEFINER functions, so revoking direct EXECUTE from
-- `authenticated` and `anon` is safe.

DO $$
DECLARE
  r record;
  keep_authenticated text[] := ARRAY[
    -- Portal (chamado via RPC pelo cliente público; já usa _token)
    'get_portal_branding','get_portal_by_slug','get_portal_by_token',
    'get_portal_client_context','get_portal_comments','get_portal_contract_documents',
    'get_portal_faqs','get_portal_feedback','get_portal_initial_questions',
    'get_portal_materials','get_portal_meetings','get_portal_monthly_summaries',
    'get_portal_onboarding','get_portal_payment_methods','get_portal_payments',
    'get_portal_phases','get_portal_project_history','get_portal_timeline_phases',
    'portal_add_comment','portal_add_meeting_notes','portal_answer_initial_question',
    'portal_confirm_meeting','portal_email_allowed','portal_record_visit',
    'portal_submit_feedback','portal_submit_initial_questions',
    'portal_toggle_deliverable','portal_toggle_onboarding_step','portal_token_active',
    -- Authorization helpers (usados em RLS policies + frontend)
    'has_role','has_any_role','is_owner','is_admin_or_owner','is_self_team_member',
    'current_team_member_id','current_user_departments','current_user_has_sensitive_access',
    'user_can_access_project','user_can_access_client','accountant_access_enabled',
    -- RPCs explicitamente chamadas pelo frontend
    'log_audit_entry','send_notification_to_user','get_profiles_basic',
    'get_system_config_value','apply_project_deliverable_tasks',
    'backfill_deliverable_tasks','activate_renewal_project','cancel_scheduled_renewal',
    'rollback_renewal_project','resolve_deliverable_assignee',
    'enqueue_email','read_email_batch','delete_email','move_to_dlq',
    -- Test helpers (úteis em desenvolvimento)
    'test_payment_sync_e2e','test_product_rename_cascade'
  ];
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    IF NOT (r.proname = ANY(keep_authenticated)) THEN
      BEGIN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated;',
                       r.proname, r.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;',
                       r.proname, r.args);
      EXCEPTION WHEN OTHERS THEN
        -- ignore (função pode já estar sem permissão)
        NULL;
      END;
    END IF;
  END LOOP;
END $$;