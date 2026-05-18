-- ============================================================
-- Fase A: Security sweep
-- ============================================================

-- 1. Helper: confirma membro ativo da equipa
CREATE OR REPLACE FUNCTION public.is_active_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE profile_id = auth.uid() AND status = 'ativo'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_team_member() TO authenticated;

-- 2. Recriar políticas "always true" com restrição a membros ativos
-- planning_quarter_notes
DROP POLICY IF EXISTS "Authenticated can insert quarter notes" ON public.planning_quarter_notes;
DROP POLICY IF EXISTS "Authenticated can update quarter notes" ON public.planning_quarter_notes;
DROP POLICY IF EXISTS "Authenticated can delete quarter notes" ON public.planning_quarter_notes;
CREATE POLICY "Team members can insert quarter notes" ON public.planning_quarter_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_active_team_member());
CREATE POLICY "Team members can update quarter notes" ON public.planning_quarter_notes
  FOR UPDATE TO authenticated USING (public.is_active_team_member());
CREATE POLICY "Team members can delete quarter notes" ON public.planning_quarter_notes
  FOR DELETE TO authenticated USING (public.is_active_team_member());

-- client_requests
DROP POLICY IF EXISTS "Authenticated can manage client requests" ON public.client_requests;
CREATE POLICY "Team members can manage client requests" ON public.client_requests
  FOR ALL TO authenticated
  USING (public.is_active_team_member())
  WITH CHECK (public.is_active_team_member());

-- meeting_prep_items
DROP POLICY IF EXISTS "Authenticated can manage meeting prep items" ON public.meeting_prep_items;
CREATE POLICY "Team members can manage meeting prep items" ON public.meeting_prep_items
  FOR ALL TO authenticated
  USING (public.is_active_team_member())
  WITH CHECK (public.is_active_team_member());

-- product_recurring_items
DROP POLICY IF EXISTS "Authenticated users can manage product recurring items" ON public.product_recurring_items;
CREATE POLICY "Team members can manage product recurring items" ON public.product_recurring_items
  FOR ALL TO authenticated
  USING (public.is_active_team_member())
  WITH CHECK (public.is_active_team_member());

-- project_recurring_occurrences
DROP POLICY IF EXISTS "Authenticated users can manage project recurring occurrences" ON public.project_recurring_occurrences;
CREATE POLICY "Team members can manage project recurring occurrences" ON public.project_recurring_occurrences
  FOR ALL TO authenticated
  USING (public.is_active_team_member())
  WITH CHECK (public.is_active_team_member());

-- 3. REVOKE execução anónima de funções internas (chamadas só por triggers ou código autenticado).
-- Mantemos anon em portal_* e get_portal_* (acedidas via token público).
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT LIKE 'portal\_%'
      AND p.proname NOT LIKE 'get\_portal\_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC',
                   fn.proname, fn.args);
  END LOOP;
END $$;