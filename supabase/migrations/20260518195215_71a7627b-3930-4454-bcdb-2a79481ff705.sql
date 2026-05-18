-- 1. Anon should never be able to bootstrap projects
REVOKE EXECUTE ON FUNCTION public.bootstrap_project_from_product(uuid) FROM anon;

-- 2. Internal-only functions: revoke from authenticated, keep service_role + postgres
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.enqueue_email(text,jsonb)',
    'public.read_email_batch(text,integer,integer)',
    'public.delete_email(text,bigint)',
    'public.move_to_dlq(text,text,bigint,jsonb)',
    'public.queue_transactional_email(text,text,text,jsonb)',
    'public.cleanup_old_audit_logs()',
    'public.notify_meetings_missing_link()',
    'public.renew_recurring_cycles()',
    'public.generate_cycle_occurrences(uuid)',
    'public.generate_cycle_phases(uuid)',
    'public.backfill_deliverable_tasks()',
    'public.apply_product_portal_template(uuid,uuid,text[],text)',
    'public.apply_project_deliverable_tasks(uuid)',
    'public.sync_portal_faqs_from_product(uuid)',
    'public.sync_project_with_template(uuid)',
    'public.sync_supplier_expenses_from_contract(uuid,uuid)',
    'public.test_payment_sync_e2e()',
    'public.test_product_rename_cascade()',
    'public.notify_team_users(text,text,text,text,text,uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated, anon', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip missing function: %', fn;
    END;
  END LOOP;
END $$;