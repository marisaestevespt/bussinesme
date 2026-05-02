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
  _bs record;
  _result jsonb;
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
    SELECT COALESCE(portal_branding, '{}'::jsonb), name INTO _pb, _product_name
    FROM public.products
    WHERE id = _product_id;
  END IF;

  SELECT business_name, primary_color, accent_color, text_color,
         font_display, font_body, logo_url, login_bg_url, welcome_text
  INTO _bs
  FROM public.business_settings
  LIMIT 1;

  -- Hierarchy: Product (if set) → Business → Bordeaux fallback
  _result := jsonb_build_object(
    'business_name',  COALESCE(NULLIF(_pb->>'business_name', ''),  _bs.business_name),
    'primary_color',  COALESCE(NULLIF(_pb->>'primary_color', ''), NULLIF(_bs.primary_color, ''), '351 56% 28%'),
    'accent_color',   COALESCE(NULLIF(_pb->>'accent_color', ''),  NULLIF(_bs.accent_color, ''),  '26 40% 39%'),
    'text_color',     COALESCE(NULLIF(_pb->>'text_color', ''),    NULLIF(_bs.text_color, ''),    '0 0% 16%'),
    'font_display',   COALESCE(NULLIF(_pb->>'font_display', ''),   _bs.font_display),
    'font_body',      COALESCE(NULLIF(_pb->>'font_body', ''),      _bs.font_body),
    'logo_url',       COALESCE(NULLIF(_pb->>'logo_url', ''),       _bs.logo_url),
    'welcome_text',   COALESCE(NULLIF(_pb->>'welcome_text', ''),   _bs.welcome_text),
    'login_title',    _pb->>'login_title',
    'login_subtitle', _pb->>'login_subtitle',
    'hero_image_url', COALESCE(NULLIF(_pb->>'hero_image_url', ''), _bs.login_bg_url),
    'hero_title',     _pb->>'hero_title',
    'hero_subtitle',  _pb->>'hero_subtitle',
    'client_first_name', _client_first_name,
    'client_name',       _client_name,
    'product_name',      _product_name
  );

  RETURN _result;
END;
$function$;