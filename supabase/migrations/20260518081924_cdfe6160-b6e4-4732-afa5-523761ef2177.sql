
ALTER TABLE public.product_phases
  ADD COLUMN IF NOT EXISTS cycle_day_start smallint,
  ADD COLUMN IF NOT EXISTS cycle_day_end smallint;

CREATE OR REPLACE FUNCTION public.validate_product_phase_cycle_days()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cycle_day_start IS NOT NULL AND (NEW.cycle_day_start < 1 OR NEW.cycle_day_start > 31) THEN
    RAISE EXCEPTION 'cycle_day_start must be between 1 and 31';
  END IF;
  IF NEW.cycle_day_end IS NOT NULL AND (NEW.cycle_day_end < 1 OR NEW.cycle_day_end > 31) THEN
    RAISE EXCEPTION 'cycle_day_end must be between 1 and 31';
  END IF;
  IF NEW.cycle_day_start IS NOT NULL AND NEW.cycle_day_end IS NOT NULL
     AND NEW.cycle_day_end < NEW.cycle_day_start THEN
    RAISE EXCEPTION 'cycle_day_end cannot be earlier than cycle_day_start';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_phase_cycle_days ON public.product_phases;
CREATE TRIGGER trg_validate_product_phase_cycle_days
BEFORE INSERT OR UPDATE OF cycle_day_start, cycle_day_end ON public.product_phases
FOR EACH ROW EXECUTE FUNCTION public.validate_product_phase_cycle_days();
