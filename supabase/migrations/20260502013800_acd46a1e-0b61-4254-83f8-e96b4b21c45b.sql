
ALTER TABLE public.portal_faqs ADD COLUMN IF NOT EXISTS from_template boolean NOT NULL DEFAULT false;
ALTER TABLE public.portal_timeline_phases ADD COLUMN IF NOT EXISTS from_template boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_portal_with_product_template(_portal_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product_id uuid;
  v_faqs jsonb;
  v_timeline jsonb;
  v_max_faq int;
  v_max_timeline int;
BEGIN
  SELECT c.current_product_id INTO v_product_id
  FROM client_portals cp JOIN clients c ON c.id = cp.client_id
  WHERE cp.id = _portal_id;

  IF v_product_id IS NULL THEN RETURN; END IF;

  SELECT portal_faqs_template, portal_timeline_template INTO v_faqs, v_timeline
  FROM products WHERE id = v_product_id;

  DELETE FROM portal_faqs WHERE portal_id = _portal_id AND from_template = true;
  SELECT COALESCE(MAX(sort_order), -1) INTO v_max_faq FROM portal_faqs WHERE portal_id = _portal_id;
  IF jsonb_array_length(COALESCE(v_faqs,'[]'::jsonb)) > 0 THEN
    INSERT INTO portal_faqs (portal_id, question, answer, sort_order, from_template)
    SELECT _portal_id, COALESCE(item->>'question',''), COALESCE(item->>'answer',''),
           v_max_faq + (ord)::int, true
    FROM jsonb_array_elements(v_faqs) WITH ORDINALITY AS t(item, ord)
    WHERE COALESCE(item->>'question','') <> '';
  END IF;

  DELETE FROM portal_timeline_phases WHERE portal_id = _portal_id AND from_template = true;
  SELECT COALESCE(MAX(sort_order), -1) INTO v_max_timeline FROM portal_timeline_phases WHERE portal_id = _portal_id;
  IF jsonb_array_length(COALESCE(v_timeline,'[]'::jsonb)) > 0 THEN
    INSERT INTO portal_timeline_phases (portal_id, title, status, sort_order, from_template)
    SELECT _portal_id, COALESCE(item->>'title','Fase'), COALESCE(item->>'status','por_comecar'),
           v_max_timeline + (ord)::int, true
    FROM jsonb_array_elements(v_timeline) WITH ORDINALITY AS t(item, ord)
    WHERE COALESCE(item->>'title','') <> '';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_portal_after_insert_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.sync_portal_with_product_template(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS portal_after_insert_sync ON public.client_portals;
CREATE TRIGGER portal_after_insert_sync AFTER INSERT ON public.client_portals
FOR EACH ROW EXECUTE FUNCTION public.trg_portal_after_insert_sync();

CREATE OR REPLACE FUNCTION public.trg_product_template_propagate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_portal record;
BEGIN
  IF TG_OP = 'UPDATE' AND
     OLD.portal_faqs_template IS NOT DISTINCT FROM NEW.portal_faqs_template AND
     OLD.portal_timeline_template IS NOT DISTINCT FROM NEW.portal_timeline_template THEN
    RETURN NEW;
  END IF;

  FOR v_portal IN
    SELECT cp.id FROM client_portals cp JOIN clients c ON c.id = cp.client_id
    WHERE c.current_product_id = NEW.id
  LOOP
    PERFORM public.sync_portal_with_product_template(v_portal.id);
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS product_template_propagate ON public.products;
CREATE TRIGGER product_template_propagate
AFTER UPDATE OF portal_faqs_template, portal_timeline_template
ON public.products FOR EACH ROW EXECUTE FUNCTION public.trg_product_template_propagate();
