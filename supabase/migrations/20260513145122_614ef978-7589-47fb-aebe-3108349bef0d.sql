ALTER TABLE public.product_phases
  ADD COLUMN IF NOT EXISTS recurrence_week_of_month smallint;

ALTER TABLE public.project_phases
  ADD COLUMN IF NOT EXISTS recurrence_week_of_month smallint;

COMMENT ON COLUMN public.product_phases.recurrence_week_of_month IS
  'Quando preenchido (1..4 = 1ª a 4ª semana, 5 = última semana), recurrence_anchor_day passa a ser o dia da semana (1=Seg..7=Dom) e a fase recorre nessa Nª ocorrência do dia da semana no mês. Quando NULL, recurrence_anchor_day é o dia fixo do mês (1-31) ou da semana, conforme a frequência.';

COMMENT ON COLUMN public.project_phases.recurrence_week_of_month IS
  'Ver product_phases.recurrence_week_of_month — herdado do template ao criar projeto.';