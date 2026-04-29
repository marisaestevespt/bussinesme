
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_imp_owner ON public.impersonation_sessions(owner_user_id, started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can manage own impersonation sessions" ON public.impersonation_sessions;
CREATE POLICY "Owner can manage own impersonation sessions"
  ON public.impersonation_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id AND public.is_owner())
  WITH CHECK (auth.uid() = owner_user_id AND public.is_owner());
