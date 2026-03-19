
-- Add product_id to executive_objectives for filtering auto-calculated values by product
ALTER TABLE public.executive_objectives ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Add product_id to objective_metrics for filtering auto-calculated values by product
ALTER TABLE public.objective_metrics ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
