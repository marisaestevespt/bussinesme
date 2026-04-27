-- Schedule daily activation of scheduled client renewals
-- Runs at 04:30 UTC, before check-renewal-status (09:15 UTC) so newly-activated
-- clients get fresh renewal-window checks the same day if applicable.

DO $$
DECLARE
  _service_role_key text;
BEGIN
  -- Remove previous schedule if any (idempotent re-run)
  PERFORM cron.unschedule('process-scheduled-renewals-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-renewals-daily');

  -- Fetch service role key from vault (same key used by other cron jobs)
  SELECT decrypted_secret INTO _service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF _service_role_key IS NULL THEN
    RAISE EXCEPTION 'Service role key not found in vault (email_queue_service_role_key)';
  END IF;

  PERFORM cron.schedule(
    'process-scheduled-renewals-daily',
    '30 4 * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://rfzzrhldukoeuutxsixw.supabase.co/functions/v1/process-scheduled-renewals',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $cron$, _service_role_key)
  );
END $$;