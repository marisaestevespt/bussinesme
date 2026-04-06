-- Create product diagnostic questions table
CREATE TABLE public.product_diagnostic_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  question_group TEXT NOT NULL DEFAULT 'geral',
  question TEXT NOT NULL DEFAULT '',
  internal_note TEXT,
  answer_type TEXT NOT NULL DEFAULT 'text',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_diagnostic_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product diagnostic questions"
ON public.product_diagnostic_questions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX idx_product_diagnostic_questions_product ON public.product_diagnostic_questions(product_id);
