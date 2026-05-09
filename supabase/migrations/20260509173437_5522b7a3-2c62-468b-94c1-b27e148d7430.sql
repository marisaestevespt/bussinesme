-- 1) Merge sales_faqs into sales_objections
UPDATE public.products
SET sales_objections = COALESCE(sales_objections, '[]'::jsonb) || (
  SELECT jsonb_agg(jsonb_build_object('objection', f->>'question', 'response', f->>'answer'))
  FROM jsonb_array_elements(sales_faqs) f
  WHERE f->>'question' IS NOT NULL AND length(trim(f->>'question')) > 0
)
WHERE jsonb_typeof(sales_faqs) = 'array' AND jsonb_array_length(sales_faqs) > 0;

ALTER TABLE public.products DROP COLUMN IF EXISTS sales_faqs;

-- 2) Update get_portal_branding to fallback to products.branding
CREATE OR REPLACE FUNCTION public.get_portal_branding(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_id uuid;
  _product_id uuid;
  _client_name text;
  _client_first_name text;
  _product_name text;
  _pb jsonb := '{}'::jsonb;
  _br jsonb := '{}'::jsonb;
  _bs record;
  _result jsonb;
  -- helper: only accept HSL triplet (skip hex like "#aabbcc")
  _br_primary text;
  _br_accent  text;
  _br_text    text;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT current_product_id, full_name INTO _product_id, _client_name
  FROM public.clients
  WHERE id = _client_id
  LIMIT 1;

  _client_first_name := split_part(COALESCE(_client_name,''), ' ', 1);

  IF _product_id IS NOT NULL THEN
    SELECT COALESCE(portal_branding, '{}'::jsonb), COALESCE(branding, '{}'::jsonb), name
    INTO _pb, _br, _product_name
    FROM public.products
    WHERE id = _product_id;
  END IF;

  -- Skip hex values from product.branding (only HSL triplets are valid CSS vars)
  _br_primary := CASE WHEN (_br->>'primary_color') IS NOT NULL AND left(_br->>'primary_color',1) <> '#' THEN _br->>'primary_color' END;
  _br_accent  := CASE WHEN (_br->>'accent_color')  IS NOT NULL AND left(_br->>'accent_color',1)  <> '#' THEN _br->>'accent_color'  END;
  _br_text    := CASE WHEN (_br->>'text_color')    IS NOT NULL AND left(_br->>'text_color',1)    <> '#' THEN _br->>'text_color'    END;

  SELECT business_name, primary_color, accent_color, text_color,
         font_display, font_body, logo_url, login_bg_url, welcome_text
  INTO _bs
  FROM public.business_settings
  LIMIT 1;

  -- Hierarchy: portal_branding (specific) → product.branding → business_settings → fallback
  _result := jsonb_build_object(
    'business_name',  COALESCE(NULLIF(_pb->>'business_name', ''),  NULLIF(_br->>'business_name',''), _bs.business_name),
    'primary_color',  COALESCE(NULLIF(_pb->>'primary_color', ''), NULLIF(_br_primary,''), NULLIF(_bs.primary_color, ''), '351 56% 28%'),
    'accent_color',   COALESCE(NULLIF(_pb->>'accent_color', ''),  NULLIF(_br_accent,''),  NULLIF(_bs.accent_color, ''),  '26 40% 39%'),
    'text_color',     COALESCE(NULLIF(_pb->>'text_color', ''),    NULLIF(_br_text,''),    NULLIF(_bs.text_color, ''),    '0 0% 16%'),
    'font_display',   COALESCE(NULLIF(_pb->>'font_display', ''),   NULLIF(_br->>'font_display',''), _bs.font_display),
    'font_body',      COALESCE(NULLIF(_pb->>'font_body', ''),      NULLIF(_br->>'font_body',''),    _bs.font_body),
    'logo_url',       COALESCE(NULLIF(_pb->>'logo_url', ''),       NULLIF(_br->>'logo_url',''),     _bs.logo_url),
    'welcome_text',   COALESCE(NULLIF(_pb->>'welcome_text', ''),   NULLIF(_br->>'welcome_text',''), _bs.welcome_text),
    'login_title',    _pb->>'login_title',
    'login_subtitle', _pb->>'login_subtitle',
    'hero_image_url', COALESCE(NULLIF(_pb->>'hero_image_url', ''), NULLIF(_br->>'hero_image_url',''), _bs.login_bg_url),
    'hero_title',     _pb->>'hero_title',
    'hero_subtitle',  _pb->>'hero_subtitle',
    'client_first_name', _client_first_name,
    'client_name',       _client_name,
    'product_name',      _product_name
  );

  RETURN _result;
END;
$function$;