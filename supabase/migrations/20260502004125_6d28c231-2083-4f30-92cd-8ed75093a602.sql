-- Drop the wrong overload I created earlier (uses non-existent columns)
DROP FUNCTION IF EXISTS public.portal_answer_initial_question(text, uuid, text, jsonb);

-- Fix the real one: remove the bad ::text cast on jsonb column
CREATE OR REPLACE FUNCTION public.portal_answer_initial_question(
  _token uuid,
  _question_id uuid,
  _answer text,
  _file_urls jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _portal_id uuid;
BEGIN
  SELECT id INTO _portal_id FROM public.client_portals WHERE token = _token AND is_active = true;
  IF _portal_id IS NULL THEN RETURN false; END IF;
  UPDATE public.portal_initial_questions
  SET answer = _answer,
      file_urls = COALESCE(_file_urls, file_urls),
      answered_at = COALESCE(answered_at, now())
  WHERE id = _question_id AND portal_id = _portal_id;
  RETURN FOUND;
END $function$;