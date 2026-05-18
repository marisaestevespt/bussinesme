-- 1. Backfill estimated_minutes from estimated_time (hours) where missing
UPDATE public.tasks
SET estimated_minutes = ROUND(estimated_time * 60)::int
WHERE estimated_time IS NOT NULL AND estimated_minutes IS NULL;

-- 2. Drop deprecated columns
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS icon,
  DROP COLUMN IF EXISTS cover_url,
  DROP COLUMN IF EXISTS renewal_id,
  DROP COLUMN IF EXISTS recurrence_type,
  DROP COLUMN IF EXISTS recurrence_end,
  DROP COLUMN IF EXISTS recurrence_interval_days,
  DROP COLUMN IF EXISTS scheduled_time,
  DROP COLUMN IF EXISTS estimated_time;