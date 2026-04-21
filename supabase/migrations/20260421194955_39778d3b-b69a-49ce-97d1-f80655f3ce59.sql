-- 1) Adicionar colunas FK
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS current_product_id   uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS potential_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_current_product_id   ON public.clients(current_product_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_potential_product_id ON public.crm_leads(potential_product_id);

-- 2) Backfill com base nos nomes atuais
UPDATE public.clients c
   SET current_product_id = p.id
  FROM public.products p
 WHERE c.current_product_id IS NULL
   AND c.current_product IS NOT NULL
   AND p.name = c.current_product;

UPDATE public.crm_leads l
   SET potential_product_id = p.id
  FROM public.products p
 WHERE l.potential_product_id IS NULL
   AND l.potential_product IS NOT NULL
   AND p.name = l.potential_product;

-- 3) Triggers de auto-fill: quando se grava com product_id, preenche o text
CREATE OR REPLACE FUNCTION public.sync_clients_current_product_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.current_product_id IS NOT NULL THEN
    SELECT name INTO NEW.current_product FROM public.products WHERE id = NEW.current_product_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_clients_current_product_name ON public.clients;
CREATE TRIGGER trg_sync_clients_current_product_name
BEFORE INSERT OR UPDATE OF current_product_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_clients_current_product_name();

CREATE OR REPLACE FUNCTION public.sync_crm_leads_potential_product_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.potential_product_id IS NOT NULL THEN
    SELECT name INTO NEW.potential_product FROM public.products WHERE id = NEW.potential_product_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_crm_leads_potential_product_name ON public.crm_leads;
CREATE TRIGGER trg_sync_crm_leads_potential_product_name
BEFORE INSERT OR UPDATE OF potential_product_id ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.sync_crm_leads_potential_product_name();

-- 4) Estender o cascade de rename de produtos
CREATE OR REPLACE FUNCTION public.sync_product_name_cascade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.commercial_sales            SET product           = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.commercial_sales_actions    SET product           = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.commercial_library_entries  SET product           = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.commercial_product_goals    SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.crm_pipelines               SET product           = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.events                      SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.marketing_automations       SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.marketing_funnels           SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.traffic_creatives           SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.portal_project_history      SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.capacity_scenario_products  SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.content_items               SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.meetings                    SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.projects                    SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.sops                        SET product_name      = NEW.name WHERE product_id           = NEW.id;
    UPDATE public.clients                     SET current_product   = NEW.name WHERE current_product_id   = NEW.id;
    UPDATE public.crm_leads                   SET potential_product = NEW.name WHERE potential_product_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;