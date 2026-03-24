
CREATE TABLE public.product_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, payment_method)
);

ALTER TABLE public.product_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product payment methods"
ON public.product_payment_methods
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
