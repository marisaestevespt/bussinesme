CREATE TABLE IF NOT EXISTS public.edge_function_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL CHECK (status IN ('success','failed','warning','running')),
  attempts integer NOT NULL DEFAULT 1,
  error_message text,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_function_runs_name_date ON public.edge_function_runs(function_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_edge_function_runs_status ON public.edge_function_runs(status, started_at DESC);

ALTER TABLE public.edge_function_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/owners can view edge function runs"
ON public.edge_function_runs FOR SELECT
USING (public.is_admin_or_owner());

-- No INSERT/UPDATE/DELETE policies = only service role (which bypasses RLS) can write.