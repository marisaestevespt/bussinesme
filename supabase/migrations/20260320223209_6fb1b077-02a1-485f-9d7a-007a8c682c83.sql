
-- Table for manual feedback entries per client
CREATE TABLE public.client_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage client_feedback"
  ON public.client_feedback
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
