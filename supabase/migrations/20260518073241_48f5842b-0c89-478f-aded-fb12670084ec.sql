-- Função: força phase_id=NULL em itens recorrentes
CREATE OR REPLACE FUNCTION public.enforce_recurring_no_phase()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_recurring = true AND NEW.phase_id IS NOT NULL THEN
    NEW.phase_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger no template do produto
DROP TRIGGER IF EXISTS trg_product_deliverable_recurring_no_phase ON public.product_deliverable_templates;
CREATE TRIGGER trg_product_deliverable_recurring_no_phase
BEFORE INSERT OR UPDATE ON public.product_deliverable_templates
FOR EACH ROW
EXECUTE FUNCTION public.enforce_recurring_no_phase();

-- Trigger na instância do projeto
DROP TRIGGER IF EXISTS trg_project_deliverable_recurring_no_phase ON public.project_deliverables;
CREATE TRIGGER trg_project_deliverable_recurring_no_phase
BEFORE INSERT OR UPDATE ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_recurring_no_phase();