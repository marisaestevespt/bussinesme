
-- L2 — Apertar RLS e adicionar constraints em projects, project_members, project_phases, project_deliverables

-- Helper: pode editar um projeto?
CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_staff'::app_role)
    OR user_in_department('comercial')
    OR user_in_department('operacao')
    OR user_in_department('clientes')
    OR user_can_access_project(_project_id);
$$;

-- ─── project_members ─────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated can delete project members" ON public.project_members;

CREATE POLICY "project_members_select_authenticated"
  ON public.project_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "project_members_insert_editors"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (can_edit_project(project_id));

CREATE POLICY "project_members_delete_editors"
  ON public.project_members FOR DELETE TO authenticated
  USING (can_edit_project(project_id));

-- ─── project_phases ──────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can view project_phases" ON public.project_phases;
DROP POLICY IF EXISTS "Authenticated can insert project_phases" ON public.project_phases;
DROP POLICY IF EXISTS "Authenticated can update project_phases" ON public.project_phases;
DROP POLICY IF EXISTS "Owners can delete project_phases" ON public.project_phases;

CREATE POLICY "project_phases_select_authenticated"
  ON public.project_phases FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "project_phases_insert_editors"
  ON public.project_phases FOR INSERT TO authenticated
  WITH CHECK (can_edit_project(project_id));

CREATE POLICY "project_phases_update_editors"
  ON public.project_phases FOR UPDATE TO authenticated
  USING (can_edit_project(project_id))
  WITH CHECK (can_edit_project(project_id));

CREATE POLICY "project_phases_delete_editors"
  ON public.project_phases FOR DELETE TO authenticated
  USING (can_edit_project(project_id));

-- ─── project_deliverables ────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage deliverables" ON public.project_deliverables;

CREATE POLICY "project_deliverables_select_authenticated"
  ON public.project_deliverables FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "project_deliverables_insert_editors"
  ON public.project_deliverables FOR INSERT TO authenticated
  WITH CHECK (can_edit_project(project_id));

CREATE POLICY "project_deliverables_update_editors"
  ON public.project_deliverables FOR UPDATE TO authenticated
  USING (can_edit_project(project_id))
  WITH CHECK (can_edit_project(project_id));

CREATE POLICY "project_deliverables_delete_editors"
  ON public.project_deliverables FOR DELETE TO authenticated
  USING (can_edit_project(project_id));

-- ─── CHECK constraints em projects ───────────────────────
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'em_ideia','em_onboarding','agendado','em_curso','em_pausa',
    'em_revisao','concluido','cancelado','arquivo'
  ));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_type_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_type_check
  CHECK (type IN ('cliente_projeto_unico','cliente_servico_mensal','interno'));
