-- Trigger de garantia: todo cliente tem entrada de origem em client_history.
-- Usa CONSTRAINT TRIGGER DEFERRED para correr no fim da transacao,
-- permitindo que a logica de conversao de lead crie a sua propria entrada primeiro.

CREATE OR REPLACE FUNCTION public.ensure_client_origin_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se ja existe alguma entrada para este cliente em client_history, nada a fazer.
  IF EXISTS (
    SELECT 1 FROM public.client_history WHERE client_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Caso contrario, cria entrada de origem 'Direto' (sem lead_id).
  INSERT INTO public.client_history (client_id, entry_date, milestone, lead_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.client_since, NEW.created_at::date, CURRENT_DATE),
    'Cliente criado | Origem: Direto (sem lead no CRM)',
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_client_origin ON public.clients;

CREATE CONSTRAINT TRIGGER trg_ensure_client_origin
  AFTER INSERT ON public.clients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_client_origin_entry();