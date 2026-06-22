-- Sincronizar status='arquivo' com archived_at
CREATE OR REPLACE FUNCTION public.sync_project_archived_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'arquivo' AND NEW.archived_at IS NULL THEN
    NEW.archived_at := now();
  ELSIF NEW.status IS DISTINCT FROM 'arquivo' AND OLD.status = 'arquivo' THEN
    -- saiu do status arquivo: limpa archived_at
    NEW.archived_at := NULL;
  ELSIF NEW.archived_at IS NOT NULL AND NEW.status <> 'arquivo' AND (TG_OP = 'INSERT' OR OLD.archived_at IS NULL) THEN
    -- alguém preencheu archived_at sem mudar status: força status = arquivo
    NEW.status := 'arquivo';
  ELSIF NEW.archived_at IS NULL AND OLD.archived_at IS NOT NULL AND NEW.status = 'arquivo' THEN
    -- restaurou (archived_at limpo) mas status ainda arquivo: volta para em_curso
    NEW.status := 'em_curso';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_archived_at ON public.projects;
CREATE TRIGGER trg_sync_project_archived_at
BEFORE INSERT OR UPDATE OF status, archived_at ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_archived_at();

-- Backfill: projetos com status='arquivo' sem archived_at
UPDATE public.projects
SET archived_at = COALESCE(updated_at, created_at, now())
WHERE status = 'arquivo' AND archived_at IS NULL;

-- Backfill inverso: projetos com archived_at mas status diferente
UPDATE public.projects
SET status = 'arquivo'
WHERE archived_at IS NOT NULL AND status <> 'arquivo';