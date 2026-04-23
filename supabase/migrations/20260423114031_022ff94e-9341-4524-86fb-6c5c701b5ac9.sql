-- 1) Coluna de branding por produto
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS portal_branding jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) RPC pública para o portal carregar branding (produto -> fallback business_settings)
CREATE OR REPLACE FUNCTION public.get_portal_branding(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _product_id uuid;
  _pb jsonb := '{}'::jsonb;
  _bs record;
  _result jsonb;
BEGIN
  -- Validar token e obter cliente
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Produto atual do cliente (se houver)
  SELECT current_product_id INTO _product_id
  FROM public.clients
  WHERE id = _client_id
  LIMIT 1;

  IF _product_id IS NOT NULL THEN
    SELECT COALESCE(portal_branding, '{}'::jsonb) INTO _pb
    FROM public.products
    WHERE id = _product_id;
  END IF;

  -- Identidade visual global do negócio (fallback)
  SELECT business_name, primary_color, accent_color, text_color,
         font_display, font_body, logo_url
  INTO _bs
  FROM public.business_settings
  LIMIT 1;

  _result := jsonb_build_object(
    'business_name',  COALESCE(NULLIF(_pb->>'business_name', ''),  _bs.business_name),
    'primary_color',  COALESCE(NULLIF(_pb->>'primary_color', ''),  _bs.primary_color),
    'accent_color',   COALESCE(NULLIF(_pb->>'accent_color', ''),   _bs.accent_color),
    'text_color',     COALESCE(NULLIF(_pb->>'text_color', ''),     _bs.text_color),
    'font_display',   COALESCE(NULLIF(_pb->>'font_display', ''),   _bs.font_display),
    'font_body',      COALESCE(NULLIF(_pb->>'font_body', ''),      _bs.font_body),
    'logo_url',       COALESCE(NULLIF(_pb->>'logo_url', ''),       _bs.logo_url),
    'welcome_text',   _pb->>'welcome_text',
    'login_title',    _pb->>'login_title',
    'login_subtitle', _pb->>'login_subtitle',
    'hero_image_url', _pb->>'hero_image_url',
    'hero_title',     _pb->>'hero_title',
    'hero_subtitle',  _pb->>'hero_subtitle'
  );

  RETURN _result;
END;
$$;

-- Permitir invocação anónima (o portal usa anon key + token)
GRANT EXECUTE ON FUNCTION public.get_portal_branding(uuid) TO anon, authenticated;