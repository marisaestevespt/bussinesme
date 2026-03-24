CREATE TABLE public.product_improvements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product improvements"
ON public.product_improvements FOR ALL TO authenticated USING (true) WITH CHECK (true);