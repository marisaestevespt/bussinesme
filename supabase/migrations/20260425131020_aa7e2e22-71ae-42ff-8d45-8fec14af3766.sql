-- Fix broken notification links in DB functions
CREATE OR REPLACE FUNCTION public.notify_owners_on_sale_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner_user_id uuid;
  _author_name text;
  _client_label text;
  _client_id uuid;
  _link text;
  _amount text;
BEGIN
  IF NEW.client IS NULL OR btrim(NEW.client) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by IS NOT NULL AND public.has_role(NEW.created_by, 'owner') THEN
    RETURN NEW;
  END IF;
  IF NEW.created_by IS NOT NULL THEN
    SELECT full_name INTO _author_name FROM public.profiles WHERE user_id = NEW.created_by LIMIT 1;
  END IF;
  _author_name := COALESCE(_author_name, 'A contabilista');
  SELECT id INTO _client_id FROM public.clients WHERE full_name = NEW.client LIMIT 1;
  _link := CASE WHEN _client_id IS NOT NULL THEN '/hub/clientes/' || _client_id::text ELSE '/hub/financeiro/entradas' END;
  _client_label := NEW.client;
  _amount := COALESCE(to_char(NEW.invoice_total, 'FM999G999G990D00') || ' €', '');
  FOR _owner_user_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      _owner_user_id,
      'sale_added_by_accountant',
      '🧾 Nova fatura num cliente',
      _author_name || ' adicionou uma fatura' ||
        CASE WHEN _amount <> '' THEN ' de ' || _amount ELSE '' END ||
        ' em ' || _client_label || '.',
      _link
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_portal_questions_submitted(_client_name text, _client_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner_user_id uuid;
  _link text;
BEGIN
  _link := '/hub/clientes/' || _client_id::text;
  FOR _owner_user_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = _owner_user_id
        AND n.title = '📋 Respostas iniciais submetidas'
        AND n.link = _link
        AND n.created_at >= now() - interval '30 days'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        _owner_user_id,
        'portal_questions_submitted',
        '📋 Respostas iniciais submetidas',
        _client_name || ' submeteu as respostas às perguntas iniciais do portal.',
        _link
      );
    END IF;
  END LOOP;
END;
$function$;