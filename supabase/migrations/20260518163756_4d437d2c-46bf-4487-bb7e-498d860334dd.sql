-- =============================================================================
-- 1) Drop orphan tables (0 rows, 0 code references)
-- =============================================================================
DROP TABLE IF EXISTS public.crm_pipeline_labels CASCADE;
DROP TABLE IF EXISTS public.product_traffic_ads CASCADE;

-- =============================================================================
-- 2) Extend product_name sync to cover commercial_sales(.product) and 
--    commercial_sales_actions(.product) — same pattern, different column name
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_product_text_from_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN
    NEW.product := NULL;
  ELSE
    SELECT name INTO NEW.product FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_text ON public.commercial_sales;
CREATE TRIGGER trg_sync_product_text
BEFORE INSERT OR UPDATE OF product_id ON public.commercial_sales
FOR EACH ROW EXECUTE FUNCTION public.sync_product_text_from_id();

DROP TRIGGER IF EXISTS trg_sync_product_text ON public.commercial_sales_actions;
CREATE TRIGGER trg_sync_product_text
BEFORE INSERT OR UPDATE OF product_id ON public.commercial_sales_actions
FOR EACH ROW EXECUTE FUNCTION public.sync_product_text_from_id();

-- =============================================================================
-- 3) Client name sync for commercial_sales.client ← clients.full_name
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_client_text_from_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    NEW.client := NULL;
  ELSE
    SELECT full_name INTO NEW.client FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_text ON public.commercial_sales;
CREATE TRIGGER trg_sync_client_text
BEFORE INSERT OR UPDATE OF client_id ON public.commercial_sales
FOR EACH ROW EXECUTE FUNCTION public.sync_client_text_from_id();

-- =============================================================================
-- 4) Extend products rename propagation to include the new columns
-- =============================================================================
CREATE OR REPLACE FUNCTION public.propagate_product_name_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- commercial uses a different column name ("product" instead of "product_name")
    UPDATE public.commercial_sales           SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_sales_actions   SET product      = NEW.name WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 5) Add a clients rename propagation trigger for commercial_sales.client
-- =============================================================================
CREATE OR REPLACE FUNCTION public.propagate_client_name_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    UPDATE public.commercial_sales SET client = NEW.full_name WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_client_rename ON public.clients;
CREATE TRIGGER trg_propagate_client_rename
AFTER UPDATE OF full_name ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.propagate_client_name_rename();

-- =============================================================================
-- 6) Backfill consistency
-- =============================================================================
UPDATE public.commercial_sales s SET product = p.name FROM public.products p WHERE s.product_id = p.id AND s.product IS DISTINCT FROM p.name;
UPDATE public.commercial_sales_actions s SET product = p.name FROM public.products p WHERE s.product_id = p.id AND s.product IS DISTINCT FROM p.name;
UPDATE public.commercial_sales s SET client = c.full_name FROM public.clients c WHERE s.client_id = c.id AND s.client IS DISTINCT FROM c.full_name;