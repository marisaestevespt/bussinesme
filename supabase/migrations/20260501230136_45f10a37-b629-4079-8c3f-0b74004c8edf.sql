
-- L6 — Hardening Processos (corrigido: sop_onboarding_items usa template_id)

CREATE OR REPLACE FUNCTION public.can_edit_sop(_sop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR user_in_department('operacao')
    OR EXISTS (
      SELECT 1 FROM public.sops s
      WHERE s.id = _sop_id
        AND (
          s.created_by = auth.uid()
          OR (s.department IS NOT NULL AND user_in_department(s.department))
          OR (s.departments IS NOT NULL AND EXISTS (
            SELECT 1 FROM unnest(s.departments) d WHERE user_in_department(d)
          ))
        )
    );
$$;

-- ─── sops ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can insert sops" ON public.sops;
DROP POLICY IF EXISTS "Authenticated can update sops" ON public.sops;

CREATE POLICY "sops_insert_role_based"
  ON public.sops FOR INSERT TO authenticated
  WITH CHECK (
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR user_in_department('operacao')
    OR (department IS NOT NULL AND user_in_department(department))
    OR (departments IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(departments) d WHERE user_in_department(d)
    ))
  );

CREATE POLICY "sops_update_role_based"
  ON public.sops FOR UPDATE TO authenticated
  USING (can_edit_sop(id)) WITH CHECK (can_edit_sop(id));

-- ─── sop_steps ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage sop_steps" ON public.sop_steps;
CREATE POLICY "sop_steps_select_authenticated" ON public.sop_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_steps_insert_editors" ON public.sop_steps FOR INSERT TO authenticated WITH CHECK (can_edit_sop(sop_id));
CREATE POLICY "sop_steps_update_editors" ON public.sop_steps FOR UPDATE TO authenticated USING (can_edit_sop(sop_id)) WITH CHECK (can_edit_sop(sop_id));
CREATE POLICY "sop_steps_delete_editors" ON public.sop_steps FOR DELETE TO authenticated USING (can_edit_sop(sop_id));

-- ─── sop_step_documents ──────────────────────────────────
DROP POLICY IF EXISTS "auth manage sop_step_documents" ON public.sop_step_documents;
CREATE POLICY "sop_step_documents_select_authenticated" ON public.sop_step_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_step_documents_insert_editors" ON public.sop_step_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sop_steps s WHERE s.id = step_id AND can_edit_sop(s.sop_id)));
CREATE POLICY "sop_step_documents_update_editors" ON public.sop_step_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sop_steps s WHERE s.id = step_id AND can_edit_sop(s.sop_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sop_steps s WHERE s.id = step_id AND can_edit_sop(s.sop_id)));
CREATE POLICY "sop_step_documents_delete_editors" ON public.sop_step_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sop_steps s WHERE s.id = step_id AND can_edit_sop(s.sop_id)));

-- ─── sop_onboarding_templates ────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can manage onboarding templates" ON public.sop_onboarding_templates;
CREATE POLICY "sop_onboarding_templates_select_authenticated" ON public.sop_onboarding_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_onboarding_templates_insert_editors" ON public.sop_onboarding_templates FOR INSERT TO authenticated WITH CHECK (can_edit_sop(sop_id));
CREATE POLICY "sop_onboarding_templates_update_editors" ON public.sop_onboarding_templates FOR UPDATE TO authenticated USING (can_edit_sop(sop_id)) WITH CHECK (can_edit_sop(sop_id));
CREATE POLICY "sop_onboarding_templates_delete_editors" ON public.sop_onboarding_templates FOR DELETE TO authenticated USING (can_edit_sop(sop_id));

-- ─── sop_onboarding_items (via template_id → sop_id) ─────
DROP POLICY IF EXISTS "Authenticated users can manage onboarding items" ON public.sop_onboarding_items;
CREATE POLICY "sop_onboarding_items_select_authenticated" ON public.sop_onboarding_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop_onboarding_items_insert_editors" ON public.sop_onboarding_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sop_onboarding_templates t WHERE t.id = template_id AND can_edit_sop(t.sop_id)));
CREATE POLICY "sop_onboarding_items_update_editors" ON public.sop_onboarding_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sop_onboarding_templates t WHERE t.id = template_id AND can_edit_sop(t.sop_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sop_onboarding_templates t WHERE t.id = template_id AND can_edit_sop(t.sop_id)));
CREATE POLICY "sop_onboarding_items_delete_editors" ON public.sop_onboarding_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sop_onboarding_templates t WHERE t.id = template_id AND can_edit_sop(t.sop_id)));

-- ─── CHECK constraints ──────────────────────────────────
ALTER TABLE public.sops DROP CONSTRAINT IF EXISTS sops_status_check;
ALTER TABLE public.sops ADD CONSTRAINT sops_status_check
  CHECK (status IN ('para_criar','em_criacao','ativo','em_revisao','off'));

ALTER TABLE public.sops DROP CONSTRAINT IF EXISTS sops_sop_type_check;
ALTER TABLE public.sops ADD CONSTRAINT sops_sop_type_check
  CHECK (sop_type IN ('onboarding','operacional'));

ALTER TABLE public.sops DROP CONSTRAINT IF EXISTS sops_linked_entity_type_check;
ALTER TABLE public.sops ADD CONSTRAINT sops_linked_entity_type_check
  CHECK (linked_entity_type IN ('produto','cliente','projeto','interno'));

-- ─── Trigger updated_at ──────────────────────────────────
DROP TRIGGER IF EXISTS sops_set_updated_at ON public.sops;
CREATE TRIGGER sops_set_updated_at
  BEFORE UPDATE ON public.sops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
