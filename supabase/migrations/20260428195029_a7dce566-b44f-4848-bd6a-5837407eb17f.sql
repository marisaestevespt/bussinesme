DO $$
DECLARE
  r record;
  keep_public text[] := ARRAY[
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
    'has_role','has_any_role','is_owner','is_admin_or_owner','is_self_team_member',
    'current_team_member_id','current_user_departments','current_user_has_sensitive_access',
    'user_can_access_project','user_can_access_client','accountant_access_enabled',
    'log_audit_entry','send_notification_to_user','get_profiles_basic',
    'get_system_config_value','apply_project_deliverable_tasks',
    'backfill_deliverable_tasks','activate_renewal_project','cancel_scheduled_renewal',
    'rollback_renewal_project','resolve_deliverable_assignee',
    'enqueue_email','read_email_batch','delete_email','move_to_dlq',
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
    IF NOT (r.proname = ANY(keep_public)) THEN
      BEGIN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC;',
                       r.proname, r.args);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;