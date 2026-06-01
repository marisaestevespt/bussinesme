-- Regra: o deadline do projeto = cycle_start_date (ou start_date) + cycle_duration meses do produto.
-- Em renovação (cycle_start_date muda), o deadline avança automaticamente um ciclo.
-- Aplica-se a projetos pontuais e recorrentes.

CREATE OR REPLACE FUNCTION public.set_project_deadline_from_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle integer;
  v_anchor date;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cycle_duration INTO v_cycle FROM public.products WHERE id = NEW.product_id;
  IF v_cycle IS NULL OR v_cycle <= 0 THEN
    RETURN NEW;
  END IF;

  v_anchor := COALESCE(NEW.cycle_start_date, NEW.start_date);
  IF v_anchor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-set quando:
  --  - deadline está vazia, OU
  --  - é INSERT, OU
  --  - cycle_start_date mudou (renovação), OU
  --  - product_id mudou (troca de produto)
  IF NEW.deadline IS NULL
     OR TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.cycle_start_date IS DISTINCT FROM OLD.cycle_start_date)
     OR (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id)
  THEN
    NEW.deadline := (v_anchor + (v_cycle || ' months')::interval)::date;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_deadline_from_cycle ON public.projects;
CREATE TRIGGER trg_set_project_deadline_from_cycle
BEFORE INSERT OR UPDATE OF product_id, cycle_start_date, start_date
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_deadline_from_cycle();

-- Recalcular deadlines dos projetos existentes com base na regra
UPDATE public.projects pr
SET deadline = (COALESCE(pr.cycle_start_date, pr.start_date) + (p.cycle_duration || ' months')::interval)::date
FROM public.products p
WHERE p.id = pr.product_id
  AND p.cycle_duration IS NOT NULL
  AND p.cycle_duration > 0
  AND COALESCE(pr.cycle_start_date, pr.start_date) IS NOT NULL;