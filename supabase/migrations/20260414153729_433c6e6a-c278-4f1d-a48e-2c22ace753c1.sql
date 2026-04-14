-- Add project configuration fields to products
ALTER TABLE public.products
ADD COLUMN default_project_mode text NOT NULL DEFAULT 'pontual',
ADD COLUMN task_mode text NOT NULL DEFAULT 'fases';

-- Add task_mode to projects so it's inherited from the product
ALTER TABLE public.projects
ADD COLUMN task_mode text NOT NULL DEFAULT 'fases';

-- Backfill existing products based on their product_type
UPDATE public.products SET
  default_project_mode = CASE
    WHEN product_type IN ('servico_mensal', 'retainer') THEN 'recorrente'
    ELSE 'pontual'
  END,
  task_mode = CASE
    WHEN product_type IN ('servico_mensal', 'retainer') THEN 'tarefas_livres'
    ELSE 'fases'
  END;

-- Backfill existing projects based on their project_mode
UPDATE public.projects SET
  task_mode = CASE
    WHEN project_mode = 'recorrente' THEN 'tarefas_livres'
    ELSE 'fases'
  END;