
-- Training courses table
CREATE TABLE public.training_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contract_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view training_courses" ON public.training_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert training_courses" ON public.training_courses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update training_courses" ON public.training_courses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete training_courses" ON public.training_courses FOR DELETE TO authenticated USING (true);

-- Training doubts table
CREATE TABLE public.training_doubts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  doubt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  doubt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_doubts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view training_doubts" ON public.training_doubts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert training_doubts" ON public.training_doubts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update training_doubts" ON public.training_doubts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete training_doubts" ON public.training_doubts FOR DELETE TO authenticated USING (true);
