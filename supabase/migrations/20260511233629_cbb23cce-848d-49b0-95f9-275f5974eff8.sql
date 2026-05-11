CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - interval '90 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs() FROM anon, public;

-- Remove existing schedule if present, then schedule daily at 03:00 UTC
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup-audit-logs-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '0 3 * * *',
  $$SELECT public.cleanup_old_audit_logs();$$
);