
-- Auto-fill client_id from project_id when missing
CREATE OR REPLACE FUNCTION public.fill_sale_client_id_from_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT client_id INTO NEW.client_id
    FROM public.projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_sale_client_id ON public.commercial_sales;
CREATE TRIGGER trg_fill_sale_client_id
BEFORE INSERT OR UPDATE OF project_id ON public.commercial_sales
FOR EACH ROW
WHEN (NEW.client_id IS NULL AND NEW.project_id IS NOT NULL)
EXECUTE FUNCTION public.fill_sale_client_id_from_project();

-- Make sure trg_sync_client_text runs after the fill trigger.
-- Triggers fire in alphabetical order, so prefix the fill trigger to come first.
-- (trg_fill_sale_client_id < trg_sync_client_text alphabetically — good.)

-- Backfill existing orphan rows
UPDATE public.commercial_sales s
SET client_id = p.client_id
FROM public.projects p
WHERE s.project_id = p.id
  AND s.client_id IS NULL
  AND p.client_id IS NOT NULL;
