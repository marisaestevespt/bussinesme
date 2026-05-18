-- =============================================================================
-- Auto-sync product_name cache from products.name across 11 tables
-- Pattern: BEFORE INSERT/UPDATE OF product_id on children + AFTER UPDATE OF name on products
-- Anti-loop: pg_trigger_depth() guard
-- =============================================================================

-- 1. Child-side trigger: when product_id is set/changed, fill product_name from products
CREATE OR REPLACE FUNCTION public.sync_product_name_from_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN
    NEW.product_name := NULL;
  ELSE
    SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Parent-side trigger: when products.name changes, propagate to all children
CREATE OR REPLACE FUNCTION public.propagate_product_name_rename()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avoid recursion (child trigger would re-fire)
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
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach child triggers
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'capacity_scenario_products','commercial_product_goals','content_items','events',
    'marketing_automations','marketing_funnels','meetings','portal_project_history',
    'projects','sops','traffic_creatives'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_product_name ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_sync_product_name BEFORE INSERT OR UPDATE OF product_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_product_name_from_id()',
      t
    );
  END LOOP;
END$$;

-- 4. Attach parent trigger on products
DROP TRIGGER IF EXISTS trg_propagate_product_rename ON public.products;
CREATE TRIGGER trg_propagate_product_rename
AFTER UPDATE OF name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.propagate_product_name_rename();

-- 5. One-time backfill: ensure existing rows are consistent with current product names
UPDATE public.capacity_scenario_products c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.commercial_product_goals   c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.content_items              c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.events                     c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.marketing_automations      c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.marketing_funnels          c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.meetings                   c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.portal_project_history     c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.projects                   c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.sops                       c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;
UPDATE public.traffic_creatives          c SET product_name = p.name FROM public.products p WHERE c.product_id = p.id AND c.product_name IS DISTINCT FROM p.name;