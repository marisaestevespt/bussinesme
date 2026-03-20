
-- Junction table for multiple projects per meeting
CREATE TABLE public.meeting_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, project_id)
);

ALTER TABLE public.meeting_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage meeting_projects"
  ON public.meeting_projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also add client_id to projects table for proper FK linking
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Migrate existing project→client links by matching client_name
UPDATE public.projects p
SET client_id = c.id
FROM public.clients c
WHERE p.client_name = c.full_name
  AND p.client_id IS NULL;
