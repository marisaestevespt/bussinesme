
ALTER TABLE public.commercial_sales ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_sales_client_id ON public.commercial_sales(client_id);

UPDATE public.commercial_sales s
SET client_id = c.id
FROM public.clients c
WHERE s.client_id IS NULL
  AND s.client IS NOT NULL
  AND s.client <> ''
  AND c.full_name = s.client;
