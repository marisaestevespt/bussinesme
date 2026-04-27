-- Tornar trigger mais inteligente: preencher created_by automaticamente e
-- suprimir notificação quando o autor for owner ou quando não houver contexto.

CREATE OR REPLACE FUNCTION public.notify_owners_on_sale_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_user_id uuid;
  _author_id uuid;
  _author_name text;
  _client_label text;
  _client_id uuid;
  _link text;
  _amount text;
BEGIN
  IF NEW.client IS NULL OR btrim(NEW.client) = '' THEN
    RETURN NEW;
  END IF;

  -- Resolve author: prefer NEW.created_by, fall back to auth.uid()
  _author_id := COALESCE(NEW.created_by, auth.uid());

  -- Skip notification if author is unknown (system/migration insert) or is owner/admin
  IF _author_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(_author_id, 'owner') OR public.has_role(_author_id, 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO _author_name FROM public.profiles WHERE user_id = _author_id LIMIT 1;
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