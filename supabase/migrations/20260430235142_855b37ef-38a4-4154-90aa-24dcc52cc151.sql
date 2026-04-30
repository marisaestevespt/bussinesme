
CREATE TABLE public.project_responsibilities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  party TEXT NOT NULL DEFAULT 'equipa' CHECK (party IN ('cliente','equipa','partilhada')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_responsibilities_project_id ON public.project_responsibilities(project_id);

ALTER TABLE public.project_responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage project_responsibilities"
ON public.project_responsibilities FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "block_suspended_users_responsibilities"
ON public.project_responsibilities AS RESTRICTIVE TO authenticated
USING (NOT current_user_is_suspended()) WITH CHECK (NOT current_user_is_suspended());

CREATE TRIGGER update_project_responsibilities_updated_at
BEFORE UPDATE ON public.project_responsibilities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
