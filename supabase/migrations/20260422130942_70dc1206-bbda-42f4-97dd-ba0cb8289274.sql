-- Notify owners when someone (typically the accountant) inserts a sale linked to a client
CREATE OR REPLACE FUNCTION public.notify_owners_on_sale_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_user_id uuid;
  _author_name text;
  _client_label text;
  _client_id uuid;
  _link text;
  _amount text;
BEGIN
  -- Skip if no client linkage
  IF NEW.client IS NULL OR btrim(NEW.client) = '' THEN
    RETURN NEW;
  END IF;

  -- Skip if the author is themselves an owner (avoid self-notifications)
  IF NEW.created_by IS NOT NULL AND public.has_role(NEW.created_by, 'owner') THEN
    RETURN NEW;
  END IF;

  -- Resolve author display name
  IF NEW.created_by IS NOT NULL THEN
    SELECT full_name INTO _author_name FROM public.profiles WHERE user_id = NEW.created_by LIMIT 1;
  END IF;
  _author_name := COALESCE(_author_name, 'A contabilista');

  -- Resolve client id and link target
  SELECT id INTO _client_id FROM public.clients WHERE full_name = NEW.client LIMIT 1;
  _link := CASE WHEN _client_id IS NOT NULL THEN '/clientes/' || _client_id::text ELSE '/financeiro/entradas' END;
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
$$;

DROP TRIGGER IF EXISTS trg_notify_owners_on_sale_insert ON public.commercial_sales;
CREATE TRIGGER trg_notify_owners_on_sale_insert
AFTER INSERT ON public.commercial_sales
FOR EACH ROW
EXECUTE FUNCTION public.notify_owners_on_sale_insert();