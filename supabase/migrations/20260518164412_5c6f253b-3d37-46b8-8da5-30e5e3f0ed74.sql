
-- 1. Sync clients.current_product from current_product_id on insert/update
CREATE OR REPLACE FUNCTION public.sync_client_current_product_text()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.current_product_id IS NULL THEN
    NEW.current_product := NULL;
  ELSE
    SELECT name INTO NEW.current_product FROM public.products WHERE id = NEW.current_product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_current_product ON public.clients;
CREATE TRIGGER trg_sync_client_current_product
BEFORE INSERT OR UPDATE OF current_product_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_client_current_product_text();

-- 2. Extend propagate_product_name_rename() to also update clients.current_product
CREATE OR REPLACE FUNCTION public.propagate_product_name_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.capacity_scenario_products SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_product_goals   SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.content_items              SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.events                     SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.marketing_automations      SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.marketing_funnels          SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.meetings                   SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.portal_project_history     SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.projects                   SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.sops                       SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.traffic_creatives          SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_sales           SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_sales_actions   SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.clients                    SET current_product = NEW.name WHERE current_product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Backfill for safety
UPDATE public.clients c
SET current_product = p.name
FROM public.products p
WHERE c.current_product_id = p.id
  AND c.current_product IS DISTINCT FROM p.name;
