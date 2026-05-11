-- ─── 1. Convert product_nps_config to 1:N + add recolha fields ─────────────
ALTER TABLE public.product_nps_config DROP CONSTRAINT IF EXISTS product_nps_config_product_id_key;

ALTER TABLE public.product_nps_config
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'nps',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS questions jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.product_nps_config DROP CONSTRAINT IF EXISTS product_nps_config_kind_check;
ALTER TABLE public.product_nps_config
  ADD CONSTRAINT product_nps_config_kind_check CHECK (kind IN ('nps','feedback'));

CREATE INDEX IF NOT EXISTS idx_product_nps_config_product_id ON public.product_nps_config(product_id);

-- Backfill title for existing single-config rows
UPDATE public.product_nps_config SET title = COALESCE(title, 'NPS') WHERE title IS NULL;

-- ─── 2. Extend client_nps_records ─────────────────────────────────────────
ALTER TABLE public.client_nps_records
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'nps',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS responses jsonb,
  ADD COLUMN IF NOT EXISTS config_id uuid REFERENCES public.product_nps_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS questions jsonb;

ALTER TABLE public.client_nps_records DROP CONSTRAINT IF EXISTS client_nps_records_kind_check;
ALTER TABLE public.client_nps_records
  ADD CONSTRAINT client_nps_records_kind_check CHECK (kind IN ('nps','feedback'));

CREATE INDEX IF NOT EXISTS idx_client_nps_records_config_id ON public.client_nps_records(config_id);

-- ─── 3. Drop the obsolete proactive RPC ───────────────────────────────────
DROP FUNCTION IF EXISTS public.portal_submit_proactive_nps(uuid, integer, text);

-- ─── 4. Replace portal_get_pending_nps → portal_get_recolhas (full timeline) ───
DROP FUNCTION IF EXISTS public.portal_get_pending_nps(uuid);
DROP FUNCTION IF EXISTS public.portal_get_nps_history(uuid);

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
    n.source,
    n.product_id,
    p.name AS product_name
  FROM public.client_nps_records n
  LEFT JOIN public.product_nps_config c ON c.id = n.config_id
  LEFT JOIN public.products p ON p.id = n.product_id
  WHERE n.client_id = _client_id
  ORDER BY n.expected_date ASC NULLS LAST;
END $$;

-- ─── 5. portal_submit_nps now accepts responses (for kind=feedback) ───────
DROP FUNCTION IF EXISTS public.portal_submit_nps(uuid, uuid, integer, text);

CREATE OR REPLACE FUNCTION public.portal_submit_nps(
  _token uuid,
  _record_id uuid,
  _score integer,
  _notes text DEFAULT NULL,
  _responses jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _client_id uuid;
BEGIN
  IF _score IS NULL OR _score < 0 OR _score > 10 THEN RETURN false; END IF;

  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN false; END IF;

  UPDATE public.client_nps_records
  SET nps_score = _score,
      notes = COALESCE(NULLIF(trim(_notes), ''), notes),
      responses = COALESCE(_responses, responses),
      status = 'concluido',
      actual_date = CURRENT_DATE,
      source = 'portal',
      updated_at = now()
  WHERE id = _record_id
    AND client_id = _client_id
    AND status = 'por_fazer';

  RETURN FOUND;
END $$;