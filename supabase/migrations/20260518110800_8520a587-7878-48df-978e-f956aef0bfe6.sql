CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  error_message TEXT,
  items_processed INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_function_started ON public.cron_runs (function_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON public.cron_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_status ON public.cron_runs (status) WHERE status = 'error';

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view cron runs"
ON public.cron_runs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert cron runs"
ON public.cron_runs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update cron runs"
ON public.cron_runs FOR UPDATE
TO service_role
USING (true) WITH CHECK (true);

-- Auto-purge runs older than 90 days
CREATE OR REPLACE FUNCTION public.purge_old_cron_runs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.cron_runs WHERE started_at < now() - interval '90 days';
$$;