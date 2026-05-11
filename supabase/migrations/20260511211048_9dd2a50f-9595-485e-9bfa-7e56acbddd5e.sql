
-- ─── 1. nps_categories (universal, gerida pelo Owner) ────────────────────
CREATE TABLE IF NOT EXISTS public.nps_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  department text NOT NULL CHECK (department IN ('relacao_clientes','produto','operacao','marketing','outro')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read nps_categories"
  ON public.nps_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners manage nps_categories"
  ON public.nps_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER trg_nps_categories_updated_at
  BEFORE UPDATE ON public.nps_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed iniciais
INSERT INTO public.nps_categories (key, label, description, department, sort_order) VALUES
  ('atendimento',  'Atendimento e relação',         'Como sentes a relação connosco no dia-a-dia.', 'relacao_clientes', 10),
  ('clareza',      'Clareza no processo',           'Sabes em que fase estamos e o que vem a seguir?', 'relacao_clientes', 20),
  ('comunicacao',  'Comunicação',                   'Frequência, tom e relevância dos contactos.',    'relacao_clientes', 30),
  ('prazos',       'Cumprimento de prazos',         'Entregas e marcos chegam quando combinado?',     'operacao', 40),
  ('qualidade',    'Qualidade do produto/serviço',  'O que entregamos cumpre a expectativa?',         'produto', 50),
  ('resultado',    'Resultado obtido',              'O impacto real para o teu negócio.',             'produto', 60)
ON CONFLICT (key) DO NOTHING;

-- ─── 2. client_nps_records: category_scores ──────────────────────────────
ALTER TABLE public.client_nps_records
  ADD COLUMN IF NOT EXISTS category_scores jsonb;

-- ─── 3. portal_get_recolhas: incluir categorias activas ──────────────────
DROP FUNCTION IF EXISTS public.portal_get_recolhas(uuid);

CREATE OR REPLACE FUNCTION public.portal_get_recolhas(_token uuid)
RETURNS TABLE (
  id uuid,
  kind text,
  title text,
  expected_date date,
  actual_date date,
  status text,
  nps_score integer,
  notes text,
  responses jsonb,
  questions jsonb,
  category_scores jsonb,
  categories jsonb,
  source text,
  product_id uuid,
  product_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _client_id uuid;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.kind,
    COALESCE(n.title, c.title, CASE WHEN n.kind = 'feedback' THEN 'Feedback' ELSE 'NPS' END) AS title,
    n.expected_date,
    n.actual_date,
    n.status,
    n.nps_score,
    n.notes,
    n.responses,
    COALESCE(n.questions, c.questions) AS questions,
    n.category_scores,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', cat.key,
        'label', cat.label,
        'description', cat.description,
        'department', cat.department
      ) ORDER BY cat.sort_order), '[]'::jsonb)
      FROM public.nps_categories cat
      WHERE cat.is_active = true
    ) AS categories,
    n.source,
    n.product_id,
    p.name AS product_name
  FROM public.client_nps_records n
  LEFT JOIN public.product_nps_config c ON c.id = n.config_id
  LEFT JOIN public.products p ON p.id = n.product_id
  WHERE n.client_id = _client_id
  ORDER BY n.expected_date ASC NULLS LAST;
END $$;

-- ─── 4. portal_submit_nps: aceitar category_scores ───────────────────────
DROP FUNCTION IF EXISTS public.portal_submit_nps(uuid, uuid, integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.portal_submit_nps(
  _token uuid,
  _record_id uuid,
  _score integer DEFAULT NULL,
  _notes text DEFAULT NULL,
  _responses jsonb DEFAULT NULL,
  _category_scores jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_id uuid;
  _kind text;
  _final_score integer;
  _avg numeric;
  _cat_count integer;
  _bad_score boolean;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN false; END IF;

  SELECT kind INTO _kind FROM public.client_nps_records
  WHERE id = _record_id AND client_id = _client_id AND status = 'por_fazer';

  IF _kind IS NULL THEN RETURN false; END IF;

  IF _kind = 'nps' THEN
    -- Categorias obrigatórias
    IF _category_scores IS NULL OR jsonb_typeof(_category_scores) <> 'array' THEN
      RETURN false;
    END IF;

    SELECT
      COUNT(*),
      AVG((elem->>'score')::numeric),
      bool_or((elem->>'score')::int < 0 OR (elem->>'score')::int > 10)
    INTO _cat_count, _avg, _bad_score
    FROM jsonb_array_elements(_category_scores) elem
    WHERE elem ? 'score' AND elem->>'score' IS NOT NULL;

    IF _cat_count = 0 OR _bad_score THEN RETURN false; END IF;

    _final_score := ROUND(_avg)::int;
  ELSE
    -- feedback: score directo (compatibilidade)
    IF _score IS NULL OR _score < 0 OR _score > 10 THEN RETURN false; END IF;
    _final_score := _score;
  END IF;

  UPDATE public.client_nps_records
  SET nps_score = _final_score,
      notes = COALESCE(NULLIF(trim(_notes), ''), notes),
      responses = COALESCE(_responses, responses),
      category_scores = COALESCE(_category_scores, category_scores),
      status = 'concluido',
      actual_date = CURRENT_DATE,
      source = 'portal',
      updated_at = now()
  WHERE id = _record_id
    AND client_id = _client_id
    AND status = 'por_fazer';

  RETURN FOUND;
END $$;
