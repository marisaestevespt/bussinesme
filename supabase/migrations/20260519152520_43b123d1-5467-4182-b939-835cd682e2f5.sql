
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS renegotiation_status TEXT NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS renegotiation_reason TEXT,
  ADD COLUMN IF NOT EXISTS renegotiation_started_at DATE,
  ADD COLUMN IF NOT EXISTS renegotiation_owner_id UUID,
  ADD COLUMN IF NOT EXISTS renegotiation_notes TEXT;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_renegotiation_status_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_renegotiation_status_check
  CHECK (renegotiation_status IN ('nenhuma','em_curso','concluida_renovada','concluida_perdida'));

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_renegotiation_owner_fk;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_renegotiation_owner_fk
  FOREIGN KEY (renegotiation_owner_id) REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_renegotiation_status
  ON public.clients (renegotiation_status)
  WHERE renegotiation_status <> 'nenhuma';

-- Trigger: log to client_history when renegotiation status changes
CREATE OR REPLACE FUNCTION public.log_client_renegotiation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone TEXT;
  v_obs TEXT;
BEGIN
  IF NEW.renegotiation_status IS DISTINCT FROM OLD.renegotiation_status THEN
    v_milestone := CASE NEW.renegotiation_status
      WHEN 'em_curso' THEN 'Renegociação iniciada'
      WHEN 'concluida_renovada' THEN 'Renegociação concluída — renovada'
      WHEN 'concluida_perdida' THEN 'Renegociação concluída — perdida'
      WHEN 'nenhuma' THEN 'Renegociação cancelada'
    END;

    v_obs := COALESCE(NULLIF(NEW.renegotiation_reason, ''), '');
    IF NEW.renegotiation_notes IS NOT NULL AND NEW.renegotiation_notes <> '' THEN
      v_obs := CASE WHEN v_obs = '' THEN NEW.renegotiation_notes ELSE v_obs || E'\n' || NEW.renegotiation_notes END;
    END IF;

    INSERT INTO public.client_history (client_id, entry_date, milestone, observations)
    VALUES (NEW.id, CURRENT_DATE, v_milestone, NULLIF(v_obs, ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_client_renegotiation_change_trg ON public.clients;
CREATE TRIGGER log_client_renegotiation_change_trg
AFTER UPDATE OF renegotiation_status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.log_client_renegotiation_change();
