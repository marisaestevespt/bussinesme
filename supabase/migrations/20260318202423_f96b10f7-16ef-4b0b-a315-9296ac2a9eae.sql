
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'interno',
  status TEXT NOT NULL DEFAULT 'em_ideia',
  department TEXT,
  client_name TEXT,
  deadline DATE,
  progress INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  objetivo TEXT,
  diretrizes TEXT,
  cronograma TEXT,
  dependencias TEXT,
  entregaveis TEXT,
  recursos TEXT,
  project_notes TEXT,
  closure_good TEXT,
  closure_bad TEXT,
  closure_lessons TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update projects" ON public.projects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete projects" ON public.projects FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Project members junction
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, profile_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project members" ON public.project_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert project members" ON public.project_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete project members" ON public.project_members FOR DELETE TO authenticated USING (true);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  priority TEXT NOT NULL DEFAULT 'media',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  department TEXT,
  deadline DATE,
  assigned_to UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Add project_id to meetings
ALTER TABLE public.meetings ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
