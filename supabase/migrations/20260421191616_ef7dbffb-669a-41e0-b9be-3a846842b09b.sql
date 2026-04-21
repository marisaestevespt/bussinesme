-- ─────────────────────────────────────────────
-- 1) Adicionar product_id às tabelas críticas
-- ─────────────────────────────────────────────
ALTER TABLE public.commercial_sales            ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.commercial_sales_actions    ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.commercial_library_entries  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.commercial_product_goals    ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.crm_pipelines               ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.events                      ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_automations       ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_funnels           ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.traffic_creatives           ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.portal_project_history      ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.capacity_scenario_products  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- 2) Backfill: preencher product_id usando o nome atual
-- ─────────────────────────────────────────────
UPDATE public.commercial_sales s SET product_id = p.id
  FROM public.products p WHERE s.product_id IS NULL AND s.product = p.name;

UPDATE public.commercial_sales_actions s SET product_id = p.id
  FROM public.products p WHERE s.product_id IS NULL AND s.product = p.name;

UPDATE public.commercial_library_entries e SET product_id = p.id
  FROM public.products p WHERE e.product_id IS NULL AND e.product = p.name;

UPDATE public.commercial_product_goals g SET product_id = p.id
  FROM public.products p WHERE g.product_id IS NULL AND g.product_name = p.name;

UPDATE public.crm_pipelines c SET product_id = p.id
  FROM public.products p WHERE c.product_id IS NULL AND c.product = p.name;

UPDATE public.events e SET product_id = p.id
  FROM public.products p WHERE e.product_id IS NULL AND e.product_name = p.name;

UPDATE public.marketing_automations a SET product_id = p.id
  FROM public.products p WHERE a.product_id IS NULL AND a.product_name = p.name;

UPDATE public.marketing_funnels f SET product_id = p.id
  FROM public.products p WHERE f.product_id IS NULL AND f.product_name = p.name;

UPDATE public.traffic_creatives t SET product_id = p.id
  FROM public.products p WHERE t.product_id IS NULL AND t.product_name = p.name;

UPDATE public.portal_project_history h SET product_id = p.id
  FROM public.products p WHERE h.product_id IS NULL AND h.product_name = p.name;

UPDATE public.capacity_scenario_products c SET product_id = p.id
  FROM public.products p WHERE c.product_id IS NULL AND c.product_name = p.name;

-- Backfill product_id também nas tabelas que já tinham os dois campos (caso esteja desincronizado)
UPDATE public.content_items c SET product_id = p.id
  FROM public.products p WHERE c.product_id IS NULL AND c.product_name = p.name;

UPDATE public.meetings m SET product_id = p.id
  FROM public.products p WHERE m.product_id IS NULL AND m.product_name = p.name;

UPDATE public.projects pr SET product_id = p.id
  FROM public.products p WHERE pr.product_id IS NULL AND pr.product_name = p.name;

UPDATE public.sops s SET product_id = p.id
  FROM public.products p WHERE s.product_id IS NULL AND s.product_name = p.name;

-- ─────────────────────────────────────────────
-- 3) Índices para performance dos JOINs
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commercial_sales_product_id          ON public.commercial_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_commercial_sales_actions_product_id  ON public.commercial_sales_actions(product_id);
CREATE INDEX IF NOT EXISTS idx_commercial_library_product_id        ON public.commercial_library_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_commercial_product_goals_product_id  ON public.commercial_product_goals(product_id);
CREATE INDEX IF NOT EXISTS idx_crm_pipelines_product_id             ON public.crm_pipelines(product_id);
CREATE INDEX IF NOT EXISTS idx_events_product_id                    ON public.events(product_id);
CREATE INDEX IF NOT EXISTS idx_marketing_automations_product_id     ON public.marketing_automations(product_id);
CREATE INDEX IF NOT EXISTS idx_marketing_funnels_product_id         ON public.marketing_funnels(product_id);
CREATE INDEX IF NOT EXISTS idx_traffic_creatives_product_id         ON public.traffic_creatives(product_id);
CREATE INDEX IF NOT EXISTS idx_portal_project_history_product_id    ON public.portal_project_history(product_id);
CREATE INDEX IF NOT EXISTS idx_capacity_scenario_products_pid       ON public.capacity_scenario_products(product_id);

-- ─────────────────────────────────────────────
-- 4) Trigger: ao renomear um produto, sincroniza
--    todas as colunas de texto que ainda existem
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_product_name_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.commercial_sales            SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_sales_actions    SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_library_entries  SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.commercial_product_goals    SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.crm_pipelines               SET product      = NEW.name WHERE product_id = NEW.id;
    UPDATE public.events                      SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.marketing_automations       SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.marketing_funnels           SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.traffic_creatives           SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.portal_project_history      SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.capacity_scenario_products  SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.content_items               SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.meetings                    SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.projects                    SET product_name = NEW.name WHERE product_id = NEW.id;
    UPDATE public.sops                        SET product_name = NEW.name WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_name_cascade ON public.products;
CREATE TRIGGER trg_sync_product_name_cascade
AFTER UPDATE OF name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_name_cascade();

-- ─────────────────────────────────────────────
-- 5) Trigger: ao inserir/atualizar um registo com product_id
--    preencher automaticamente o campo de texto a partir da ficha
--    (garante consistência mesmo se o frontend só passar product_id)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fill_product_name_from_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
  _text_col text := TG_ARGV[0]; -- nome da coluna de texto a preencher
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT name INTO _name FROM public.products WHERE id = NEW.product_id;
    IF _name IS NOT NULL THEN
      EXECUTE format('SELECT ($1).%I', _text_col) USING NEW;
      -- Atualiza dinamicamente o campo de texto
      NEW := NEW #= hstore(_text_col, _name);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Nota: não criamos os triggers fill_product_name_from_id automaticamente
-- porque requer a extensão hstore. Em vez disso, fazemos a sincronização
-- via trigger mais simples por tabela:

CREATE OR REPLACE FUNCTION public.sync_sales_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_sales_product_name ON public.commercial_sales;
CREATE TRIGGER trg_sync_sales_product_name BEFORE INSERT OR UPDATE OF product_id ON public.commercial_sales FOR EACH ROW EXECUTE FUNCTION public.sync_sales_product_name();

CREATE OR REPLACE FUNCTION public.sync_sales_actions_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_sales_actions_product_name ON public.commercial_sales_actions;
CREATE TRIGGER trg_sync_sales_actions_product_name BEFORE INSERT OR UPDATE OF product_id ON public.commercial_sales_actions FOR EACH ROW EXECUTE FUNCTION public.sync_sales_actions_product_name();

CREATE OR REPLACE FUNCTION public.sync_library_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_library_product_name ON public.commercial_library_entries;
CREATE TRIGGER trg_sync_library_product_name BEFORE INSERT OR UPDATE OF product_id ON public.commercial_library_entries FOR EACH ROW EXECUTE FUNCTION public.sync_library_product_name();

CREATE OR REPLACE FUNCTION public.sync_goals_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_goals_product_name ON public.commercial_product_goals;
CREATE TRIGGER trg_sync_goals_product_name BEFORE INSERT OR UPDATE OF product_id ON public.commercial_product_goals FOR EACH ROW EXECUTE FUNCTION public.sync_goals_product_name();

CREATE OR REPLACE FUNCTION public.sync_pipelines_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_pipelines_product_name ON public.crm_pipelines;
CREATE TRIGGER trg_sync_pipelines_product_name BEFORE INSERT OR UPDATE OF product_id ON public.crm_pipelines FOR EACH ROW EXECUTE FUNCTION public.sync_pipelines_product_name();

CREATE OR REPLACE FUNCTION public.sync_events_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_events_product_name ON public.events;
CREATE TRIGGER trg_sync_events_product_name BEFORE INSERT OR UPDATE OF product_id ON public.events FOR EACH ROW EXECUTE FUNCTION public.sync_events_product_name();

CREATE OR REPLACE FUNCTION public.sync_automations_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_automations_product_name ON public.marketing_automations;
CREATE TRIGGER trg_sync_automations_product_name BEFORE INSERT OR UPDATE OF product_id ON public.marketing_automations FOR EACH ROW EXECUTE FUNCTION public.sync_automations_product_name();

CREATE OR REPLACE FUNCTION public.sync_funnels_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_funnels_product_name ON public.marketing_funnels;
CREATE TRIGGER trg_sync_funnels_product_name BEFORE INSERT OR UPDATE OF product_id ON public.marketing_funnels FOR EACH ROW EXECUTE FUNCTION public.sync_funnels_product_name();

CREATE OR REPLACE FUNCTION public.sync_creatives_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_creatives_product_name ON public.traffic_creatives;
CREATE TRIGGER trg_sync_creatives_product_name BEFORE INSERT OR UPDATE OF product_id ON public.traffic_creatives FOR EACH ROW EXECUTE FUNCTION public.sync_creatives_product_name();

CREATE OR REPLACE FUNCTION public.sync_portal_history_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_portal_history_product_name ON public.portal_project_history;
CREATE TRIGGER trg_sync_portal_history_product_name BEFORE INSERT OR UPDATE OF product_id ON public.portal_project_history FOR EACH ROW EXECUTE FUNCTION public.sync_portal_history_product_name();

CREATE OR REPLACE FUNCTION public.sync_capacity_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_capacity_product_name ON public.capacity_scenario_products;
CREATE TRIGGER trg_sync_capacity_product_name BEFORE INSERT OR UPDATE OF product_id ON public.capacity_scenario_products FOR EACH ROW EXECUTE FUNCTION public.sync_capacity_product_name();

CREATE OR REPLACE FUNCTION public.sync_content_items_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_content_items_product_name ON public.content_items;
CREATE TRIGGER trg_sync_content_items_product_name BEFORE INSERT OR UPDATE OF product_id ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.sync_content_items_product_name();

CREATE OR REPLACE FUNCTION public.sync_meetings_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_meetings_product_name ON public.meetings;
CREATE TRIGGER trg_sync_meetings_product_name BEFORE INSERT OR UPDATE OF product_id ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.sync_meetings_product_name();

CREATE OR REPLACE FUNCTION public.sync_projects_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_projects_product_name ON public.projects;
CREATE TRIGGER trg_sync_projects_product_name BEFORE INSERT OR UPDATE OF product_id ON public.projects FOR EACH ROW EXECUTE FUNCTION public.sync_projects_product_name();

CREATE OR REPLACE FUNCTION public.sync_sops_product_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NEW.product_id IS NOT NULL THEN SELECT name INTO NEW.product_name FROM public.products WHERE id = NEW.product_id; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_sync_sops_product_name ON public.sops;
CREATE TRIGGER trg_sync_sops_product_name BEFORE INSERT OR UPDATE OF product_id ON public.sops FOR EACH ROW EXECUTE FUNCTION public.sync_sops_product_name();