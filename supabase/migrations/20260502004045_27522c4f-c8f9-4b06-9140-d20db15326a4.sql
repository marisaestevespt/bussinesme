CREATE OR REPLACE FUNCTION public.portal_answer_initial_question(
  _token text,
  _question_id uuid,
  _answer text,
  _file_urls jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _portal_id uuid;
  _client_id uuid;
  _result jsonb;
BEGIN
  -- Validate portal token
  SELECT id, client_id INTO _portal_id, _client_id
  FROM client_portals
  WHERE access_token = _token
    AND (expires_at IS NULL OR expires_at > now());

  IF _portal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  -- Upsert the answer
  INSERT INTO portal_initial_answers (portal_id, client_id, question_id, answer, file_urls, answered_at)
  VALUES (_portal_id, _client_id, _question_id, _answer, COALESCE(_file_urls, '[]'::jsonb), now())
  ON CONFLICT (portal_id, question_id)
  DO UPDATE SET
    answer = EXCLUDED.answer,
    file_urls = COALESCE(EXCLUDED.file_urls, portal_initial_answers.file_urls),
    answered_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;