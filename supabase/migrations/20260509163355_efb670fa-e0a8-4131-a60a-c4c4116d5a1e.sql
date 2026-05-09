
-- Reuniões: previsto vs real
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS planned_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer;

-- Backfill planned a partir do legado duration_minutes
UPDATE public.meetings
   SET planned_duration_minutes = duration_minutes
 WHERE planned_duration_minutes IS NULL
   AND duration_minutes IS NOT NULL;

-- Rotinas: formato (reunião / tarefa / entrega) e tempo estimado em minutos
ALTER TABLE public.planning_routines
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'tarefa',
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

-- Backfill estimated_minutes a partir de estimated_time (horas)
UPDATE public.planning_routines
   SET estimated_minutes = ROUND(estimated_time * 60)::int
 WHERE estimated_minutes IS NULL
   AND estimated_time IS NOT NULL;

-- SOPs: tempo estimado em minutos
ALTER TABLE public.sops
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;
