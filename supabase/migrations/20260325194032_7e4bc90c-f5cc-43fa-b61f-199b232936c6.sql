
-- Sensitive access categories per team member
CREATE TABLE public.member_sensitive_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, category)
);

ALTER TABLE public.member_sensitive_access ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read
CREATE POLICY "Authenticated users can read sensitive access"
  ON public.member_sensitive_access FOR SELECT TO authenticated
  USING (true);

-- Only owners can manage (insert/update/delete handled via owner check in app)
CREATE POLICY "Authenticated users can insert sensitive access"
  ON public.member_sensitive_access FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sensitive access"
  ON public.member_sensitive_access FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete sensitive access"
  ON public.member_sensitive_access FOR DELETE TO authenticated
  USING (true);
