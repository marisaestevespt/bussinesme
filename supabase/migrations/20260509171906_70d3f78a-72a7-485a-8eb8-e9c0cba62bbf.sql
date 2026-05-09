
-- 1. Merge portal_faqs_template into products.faqs (sem duplicar)
UPDATE public.products p
SET faqs = (
  SELECT COALESCE(jsonb_agg(DISTINCT item), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object('question', f->>'question', 'answer', f->>'answer') AS item
    FROM jsonb_array_elements(COALESCE(p.faqs, '[]'::jsonb)) f
    WHERE COALESCE(f->>'question','') <> ''
    UNION
    SELECT jsonb_build_object('question', t->>'question', 'answer', t->>'answer') AS item
    FROM jsonb_array_elements(COALESCE(p.portal_faqs_template, '[]'::jsonb)) t
    WHERE COALESCE(t->>'question','') <> ''
  ) merged
)
WHERE jsonb_typeof(COALESCE(portal_faqs_template, '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(portal_faqs_template, '[]'::jsonb)) > 0;

-- 2. Drop triggers e função obsoletos
DROP TRIGGER IF EXISTS product_template_propagate ON public.products;
DROP TRIGGER IF EXISTS portal_after_insert_sync ON public.client_portals;
DROP FUNCTION IF EXISTS public.trg_product_template_propagate();
DROP FUNCTION IF EXISTS public.trg_portal_after_insert_sync();
DROP FUNCTION IF EXISTS public.sync_portal_with_product_template(uuid);

-- 3. Nova função: popular portal_faqs a partir de products.faqs ao criar portal
CREATE OR REPLACE FUNCTION public.sync_portal_faqs_from_product(_portal_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product_id uuid;
  v_faqs jsonb;
  v_max_sort int;
BEGIN
  SELECT c.current_product_id INTO v_product_id
  FROM client_portals cp JOIN clients c ON c.id = cp.client_id
  WHERE cp.id = _portal_id;

  IF v_product_id IS NULL THEN RETURN; END IF;

  SELECT faqs INTO v_faqs FROM products WHERE id = v_product_id;

  -- Apaga apenas FAQs marcadas as vindas do template
  DELETE FROM portal_faqs WHERE portal_id = _portal_id AND from_template = true;

  SELECT COALESCE(MAX(sort_order), -1) INTO v_max_sort
  FROM portal_faqs WHERE portal_id = _portal_id;

  IF jsonb_typeof(COALESCE(v_faqs,'[]'::jsonb)) = 'array'
     AND jsonb_array_length(COALESCE(v_faqs,'[]'::jsonb)) > 0 THEN
    INSERT INTO portal_faqs (portal_id, question, answer, sort_order, from_template)
    SELECT _portal_id,
           COALESCE(item->>'question',''),
           COALESCE(item->>'answer',''),
           v_max_sort + (ord)::int,
           true
    FROM jsonb_array_elements(v_faqs) WITH ORDINALITY AS t(item, ord)
    WHERE COALESCE(item->>'question','') <> '';
  END IF;
END $$;

-- 4. Trigger ao criar portal
CREATE OR REPLACE FUNCTION public.trg_portal_after_insert_faqs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_portal_faqs_from_product(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER portal_after_insert_faqs
AFTER INSERT ON public.client_portals
FOR EACH ROW EXECUTE FUNCTION public.trg_portal_after_insert_faqs();

-- 5. Trigger ao alterar products.faqs: propaga aos portais existentes
CREATE OR REPLACE FUNCTION public.trg_product_faqs_propagate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_portal record;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.faqs IS NOT DISTINCT FROM NEW.faqs THEN
    RETURN NEW;
  END IF;
  FOR v_portal IN
    SELECT cp.id FROM client_portals cp JOIN clients c ON c.id = cp.client_id
    WHERE c.current_product_id = NEW.id
  LOOP
    PERFORM public.sync_portal_faqs_from_product(v_portal.id);
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER product_faqs_propagate
AFTER UPDATE OF faqs ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_product_faqs_propagate();

-- 6. Drop colunas obsoletas
ALTER TABLE public.products
  DROP COLUMN IF EXISTS portal_faqs_template,
  DROP COLUMN IF EXISTS portal_materials_template,
  DROP COLUMN IF EXISTS portal_timeline_template;
