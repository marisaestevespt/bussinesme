
-- Add portal template fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS portal_faqs_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_materials_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_timeline_template jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.portal_faqs_template IS 'Array of {question, answer} applied to client portals on demand.';
COMMENT ON COLUMN public.products.portal_materials_template IS 'Array of {file_name, file_url, file_type, description} applied to client portals on demand.';
COMMENT ON COLUMN public.products.portal_timeline_template IS 'Array of {title, status} applied to client portals on demand.';

-- RPC to apply a product template to a portal (Owner only).
-- Default mode is 'append': inserts template rows alongside existing ones.
-- Mode 'replace': deletes existing rows in the chosen sections then inserts template rows.
CREATE OR REPLACE FUNCTION public.apply_product_portal_template(
  _portal_id uuid,
  _product_id uuid,
  _sections text[] DEFAULT ARRAY['faqs','materials','timeline'],
  _mode text DEFAULT 'append'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faqs jsonb;
  v_materials jsonb;
  v_timeline jsonb;
  v_inserted_faqs int := 0;
  v_inserted_materials int := 0;
  v_inserted_timeline int := 0;
  v_max_faq int;
  v_max_timeline int;
BEGIN
  IF NOT has_role(auth.uid(), 'owner'::app_role) THEN
    RAISE EXCEPTION 'Only owners can apply portal templates';
  END IF;

  IF _mode NOT IN ('append','replace') THEN
    RAISE EXCEPTION 'Invalid mode %, expected append or replace', _mode;
  END IF;

  SELECT portal_faqs_template, portal_materials_template, portal_timeline_template
    INTO v_faqs, v_materials, v_timeline
  FROM public.products WHERE id = _product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', _product_id;
  END IF;

  -- FAQs
  IF 'faqs' = ANY(_sections) AND jsonb_array_length(COALESCE(v_faqs,'[]'::jsonb)) > 0 THEN
    IF _mode = 'replace' THEN
      DELETE FROM public.portal_faqs WHERE portal_id = _portal_id;
      v_max_faq := -1;
    ELSE
      SELECT COALESCE(MAX(sort_order), -1) INTO v_max_faq FROM public.portal_faqs WHERE portal_id = _portal_id;
    END IF;

    WITH ins AS (
      INSERT INTO public.portal_faqs (portal_id, question, answer, sort_order)
      SELECT _portal_id,
             COALESCE(item->>'question',''),
             COALESCE(item->>'answer',''),
             v_max_faq + 1 + (ord - 1)::int
      FROM jsonb_array_elements(v_faqs) WITH ORDINALITY AS t(item, ord)
      WHERE COALESCE(item->>'question','') <> ''
      RETURNING 1
    )
    SELECT count(*) INTO v_inserted_faqs FROM ins;
  END IF;

  -- Materials
  IF 'materials' = ANY(_sections) AND jsonb_array_length(COALESCE(v_materials,'[]'::jsonb)) > 0 THEN
    IF _mode = 'replace' THEN
      DELETE FROM public.portal_materials WHERE portal_id = _portal_id;
    END IF;

    WITH ins AS (
      INSERT INTO public.portal_materials (portal_id, file_name, file_url, file_type, description)
      SELECT _portal_id,
             COALESCE(item->>'file_name','Material'),
             COALESCE(item->>'file_url',''),
             COALESCE(item->>'file_type','file'),
             item->>'description'
      FROM jsonb_array_elements(v_materials) AS item
      WHERE COALESCE(item->>'file_url','') <> ''
      RETURNING 1
    )
    SELECT count(*) INTO v_inserted_materials FROM ins;
  END IF;

  -- Timeline
  IF 'timeline' = ANY(_sections) AND jsonb_array_length(COALESCE(v_timeline,'[]'::jsonb)) > 0 THEN
    IF _mode = 'replace' THEN
      DELETE FROM public.portal_timeline_phases WHERE portal_id = _portal_id;
      v_max_timeline := -1;
    ELSE
      SELECT COALESCE(MAX(sort_order), -1) INTO v_max_timeline FROM public.portal_timeline_phases WHERE portal_id = _portal_id;
    END IF;

    WITH ins AS (
      INSERT INTO public.portal_timeline_phases (portal_id, title, status, sort_order)
      SELECT _portal_id,
             COALESCE(item->>'title','Fase'),
             COALESCE(item->>'status','por_comecar'),
             v_max_timeline + 1 + (ord - 1)::int
      FROM jsonb_array_elements(v_timeline) WITH ORDINALITY AS t(item, ord)
      WHERE COALESCE(item->>'title','') <> ''
      RETURNING 1
    )
    SELECT count(*) INTO v_inserted_timeline FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'faqs_inserted', v_inserted_faqs,
    'materials_inserted', v_inserted_materials,
    'timeline_inserted', v_inserted_timeline,
    'mode', _mode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_product_portal_template(uuid, uuid, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_product_portal_template(uuid, uuid, text[], text) TO authenticated;
