-- Add brainstorming free-text column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brainstorming text;

-- Create product_competitors table
CREATE TABLE IF NOT EXISTS public.product_competitors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  price numeric,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_competitors_product_id ON public.product_competitors(product_id);

ALTER TABLE public.product_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view competitors"
  ON public.product_competitors FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert competitors"
  ON public.product_competitors FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update competitors"
  ON public.product_competitors FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete competitors"
  ON public.product_competitors FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_product_competitors_updated_at
  BEFORE UPDATE ON public.product_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();