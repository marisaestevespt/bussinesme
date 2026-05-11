ALTER TABLE public.product_nps_records
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'por_fazer',
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS idx_product_nps_records_client_id ON public.product_nps_records(client_id);
CREATE INDEX IF NOT EXISTS idx_product_nps_records_status ON public.product_nps_records(status);

CREATE OR REPLACE TRIGGER update_product_nps_records_updated_at
BEFORE UPDATE ON public.product_nps_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();