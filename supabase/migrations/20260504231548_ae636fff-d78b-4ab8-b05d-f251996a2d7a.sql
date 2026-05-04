DO $$
DECLARE
  sensitive_table text;
BEGIN
  FOREACH sensitive_table IN ARRAY ARRAY[
    'clients',
    'client_contacts',
    'client_onboarding',
    'client_offboarding',
    'client_renewals',
    'client_milestones',
    'client_nps_records',
    'client_activities',
    'client_history',
    'client_portals',
    'portal_visits',
    'financial_subscriptions',
    'user_roles',
    'profiles',
    'digest_settings'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = sensitive_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', sensitive_table);
    END IF;
  END LOOP;
END $$;