-- Trigger para impedir marcar lead como 'ganho' sem ter cliente associado via client_history.lead_id
CREATE OR REPLACE FUNCTION public.enforce_lead_conversion_on_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só valida se está a mudar para 'ganho' (ou inserir já como ganho)
  IF NEW.status = 'ganho' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'ganho') THEN
    -- Verificar se existe pelo menos 1 client_history a ligar este lead a um cliente
    IF NOT EXISTS (
      SELECT 1 FROM public.client_history ch WHERE ch.lead_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Lead só pode ser marcado como ganho após conversão para cliente. Usa o botão "Converter em Cliente" no detalhe do lead.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lead_conversion_on_won ON public.crm_leads;
CREATE TRIGGER trg_enforce_lead_conversion_on_won
BEFORE INSERT OR UPDATE OF status ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.enforce_lead_conversion_on_won();

-- Index para o lookup ser rápido
CREATE INDEX IF NOT EXISTS idx_client_history_lead_id ON public.client_history(lead_id) WHERE lead_id IS NOT NULL;