CREATE OR REPLACE FUNCTION public.portal_submit_nps(_token uuid, _record_id uuid, _score integer DEFAULT NULL::integer, _notes text DEFAULT NULL::text, _responses jsonb DEFAULT NULL::jsonb, _category_scores jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF _score IS NULL OR _score < 0 OR _score > 10 THEN RETURN false; END IF;
    _final_score := _score;
  END IF;

  UPDATE public.client_nps_records
  SET nps_score = _final_score,
      notes = COALESCE(NULLIF(trim(_notes), ''), notes),
      responses = COALESCE(_responses, responses),
      category_scores = COALESCE(_category_scores, category_scores),
      status = 'feito',
      actual_date = CURRENT_DATE,
      source = 'portal',
      updated_at = now()
  WHERE id = _record_id
    AND client_id = _client_id
    AND status = 'por_fazer';

  RETURN FOUND;
END $function$;