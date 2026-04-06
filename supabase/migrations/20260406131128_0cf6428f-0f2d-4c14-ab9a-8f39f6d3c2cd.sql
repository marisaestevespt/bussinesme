
CREATE OR REPLACE FUNCTION public.notify_portal_questions_submitted(_client_name text, _client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _owner_user_id uuid;
BEGIN
  FOR _owner_user_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      _owner_user_id,
      'info',
      '📋 Respostas iniciais submetidas',
      _client_name || ' submeteu as respostas às perguntas iniciais do portal.',
      '/clientes/' || _client_id::text
    );
  END LOOP;
END;
$$;
