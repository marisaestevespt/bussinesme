
CREATE TABLE public.system_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read config
CREATE POLICY "Authenticated users can read system_config"
  ON public.system_config FOR SELECT TO authenticated
  USING (true);

-- Only owners can insert/update
CREATE POLICY "Owners can manage system_config"
  ON public.system_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
