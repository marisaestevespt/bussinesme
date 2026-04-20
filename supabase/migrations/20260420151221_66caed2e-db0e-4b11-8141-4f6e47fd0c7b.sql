-- Audit table for password access operations
CREATE TABLE IF NOT EXISTS public.access_password_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('read', 'write', 'rotate', 'denied')),
  access_id uuid NULL,
  ip text NULL,
  user_agent text NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for rate limiting / blocking queries
CREATE INDEX IF NOT EXISTS idx_access_password_audit_user_created
  ON public.access_password_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_password_audit_user_action_created
  ON public.access_password_audit (user_id, action, created_at DESC);

ALTER TABLE public.access_password_audit ENABLE ROW LEVEL SECURITY;

-- Only owners can read the audit log
CREATE POLICY "Owners can read access password audit"
ON public.access_password_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

-- No INSERT/UPDATE/DELETE policies → only service role (edge function) can write