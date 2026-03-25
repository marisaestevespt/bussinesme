ALTER TABLE public.executive_objectives 
ADD COLUMN primary_metric_id uuid REFERENCES public.objective_metrics(id) ON DELETE SET NULL;