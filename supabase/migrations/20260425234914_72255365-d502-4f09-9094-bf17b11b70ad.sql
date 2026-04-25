-- ============================================================
-- FASE 2 — INTEGRIDADE DE DADOS
-- ============================================================

-- 1) Normalizar strings vazias para NULL antes de mudar o tipo
UPDATE public.member_contracts SET start_date = NULL WHERE start_date = '';
UPDATE public.member_contracts SET end_date = NULL WHERE end_date = '';
UPDATE public.team_members SET start_date = NULL WHERE start_date = '';
UPDATE public.team_members SET settlement_date = NULL WHERE settlement_date = '';
UPDATE public.feedback_sessions SET session_date = NULL WHERE session_date = '';
UPDATE public.executive_goals SET target_date = NULL WHERE target_date = '';
UPDATE public.executive_goals SET achieved_date = NULL WHERE achieved_date = '';
UPDATE public.executive_objectives SET deadline = NULL WHERE deadline = '';
UPDATE public.objective_actions SET deadline = NULL WHERE deadline = '';
UPDATE public.portal_project_history SET start_date = NULL WHERE start_date = '';
UPDATE public.portal_project_history SET end_date = NULL WHERE end_date = '';

-- 2) A view team_members_public depende de team_members.start_date — recriar
DROP VIEW IF EXISTS public.team_members_public;

-- 3) Converter colunas TEXT → DATE
ALTER TABLE public.member_contracts
  ALTER COLUMN start_date TYPE date USING start_date::date,
  ALTER COLUMN end_date   TYPE date USING end_date::date;

ALTER TABLE public.team_members
  ALTER COLUMN start_date      TYPE date USING start_date::date,
  ALTER COLUMN settlement_date TYPE date USING settlement_date::date;

ALTER TABLE public.feedback_sessions
  ALTER COLUMN session_date TYPE date USING session_date::date;

ALTER TABLE public.executive_goals
  ALTER COLUMN target_date   TYPE date USING target_date::date,
  ALTER COLUMN achieved_date TYPE date USING achieved_date::date;

ALTER TABLE public.executive_objectives
  ALTER COLUMN deadline TYPE date USING deadline::date;

ALTER TABLE public.objective_actions
  ALTER COLUMN deadline TYPE date USING deadline::date;

ALTER TABLE public.portal_project_history
  ALTER COLUMN start_date TYPE date USING start_date::date,
  ALTER COLUMN end_date   TYPE date USING end_date::date;

-- 4) Recriar view team_members_public (mantendo schema anterior)
CREATE VIEW public.team_members_public
WITH (security_invoker = on) AS
SELECT
  id, profile_id, full_name, role_title, department, departments, work_areas,
  custom_role_id, status, access_suspended, access_revoked,
  start_date, inactivated_at, photo_url, email, created_at, updated_at
FROM public.team_members;

-- 5) Sincronização Membro → Fornecedor (nome, NIF, IBAN, email)
CREATE OR REPLACE FUNCTION public.sync_member_to_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.email IS DISTINCT FROM OLD.email
  THEN
    UPDATE public.suppliers
    SET name  = COALESCE(NEW.full_name, name),
        email = COALESCE(NEW.email, email),
        updated_at = now()
    WHERE member_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_to_supplier ON public.team_members;
CREATE TRIGGER trg_sync_member_to_supplier
AFTER UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_to_supplier();

-- 6) Reforçar coerência is_meeting / deliverable_type para registos antigos
UPDATE public.project_deliverables
SET is_meeting = true
WHERE deliverable_type = 'reuniao' AND is_meeting IS DISTINCT FROM true;

UPDATE public.project_deliverables
SET is_meeting = false
WHERE (deliverable_type IS NULL OR deliverable_type <> 'reuniao')
  AND is_meeting IS DISTINCT FROM false;
