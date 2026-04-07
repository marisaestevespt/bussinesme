
CREATE TABLE public.portal_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  email text NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_visits_portal ON public.portal_visits(portal_id, visited_at DESC);

ALTER TABLE public.portal_visits ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (portal is public)
CREATE POLICY "Anyone can log portal visits"
  ON public.portal_visits FOR INSERT
  WITH CHECK (true);

-- Only authenticated users can read visits
CREATE POLICY "Authenticated users can view portal visits"
  ON public.portal_visits FOR SELECT
  TO authenticated
  USING (true);
