
-- Add show_materials toggle to client_portals
ALTER TABLE public.client_portals
  ADD COLUMN show_materials boolean NOT NULL DEFAULT true;

-- Create portal_materials table
CREATE TABLE public.portal_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'file',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_materials ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can manage, anyone can read (portal is public via token)
CREATE POLICY "Authenticated users can manage portal materials"
  ON public.portal_materials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read portal materials"
  ON public.portal_materials FOR SELECT TO anon USING (true);
