
-- Revoga EXECUTE público (anon) de todas as funções SECURITY DEFINER do schema public
-- EXCETO as funções do Portal de Cliente que precisam mesmo de ser anon-callable.

DO $$
DECLARE
  r record;
  keep_anon text[] := ARRAY[
    'get_portal_branding',
    'get_portal_by_slug',
    'get_portal_by_token',
    'get_portal_client_context',
    'get_portal_comments',
    'get_portal_contract_documents',
    'get_portal_faqs',
    'get_portal_feedback',
    'get_portal_initial_questions',
    'get_portal_materials',
    'get_portal_meetings',
    'get_portal_monthly_summaries',
    'get_portal_onboarding',
    'get_portal_payment_methods',
    'get_portal_payments',
    'get_portal_phases',
    'get_portal_project_history',
    'get_portal_timeline_phases',
    'portal_add_comment',
    'portal_add_meeting_notes',
    'portal_confirm_meeting',
    'portal_submit_initial_questions',
    'portal_toggle_deliverable',
    'portal_toggle_onboarding_step',
    'notify_portal_meeting_confirmed',
    'notify_portal_questions_submitted',
    'handle_new_user'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT (p.proname = ANY(keep_anon))
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon;', r.proname, r.args);
  END LOOP;
END $$;
