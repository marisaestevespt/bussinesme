ALTER TABLE public.commercial_sales_actions
ADD COLUMN IF NOT EXISTS enrollment_open_date date;

COMMENT ON COLUMN public.commercial_sales_actions.enrollment_open_date IS 'Data em que abrem as vagas/vendas (pode ser anterior ao start_date da campanha)';
COMMENT ON COLUMN public.commercial_sales_actions.start_date IS 'Início do período da campanha';
COMMENT ON COLUMN public.commercial_sales_actions.end_date IS 'Fim do período da campanha';