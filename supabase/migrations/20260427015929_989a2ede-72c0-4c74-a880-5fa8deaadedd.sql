-- Trigger: when product name changes, update name of related active projects
CREATE OR REPLACE FUNCTION public.sync_projects_name_on_product_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.projects p
    SET name = NEW.name || ' | ' || c.full_name
    FROM public.clients c
    WHERE p.product_id = NEW.id
      AND p.client_id = c.id
      AND p.status NOT IN ('concluido', 'cancelado', 'arquivado')
      AND (
        p.name = OLD.name || ' | ' || c.full_name
        OR p.name = c.full_name || ' | ' || OLD.name
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_projects_name_on_product_rename ON public.products;
CREATE TRIGGER trg_sync_projects_name_on_product_rename
AFTER UPDATE OF name ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_projects_name_on_product_rename();