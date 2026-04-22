-- =========================================================
-- P1 SECURITY HARDENING: Replace permissive RLS + lock buckets
-- =========================================================

-- Helper: replace a permissive ALL policy with auth-required ALL policy
-- We do this individually per (table, policy_name) to be explicit and auditable.

-- ===== portal_* tables =====
DROP POLICY IF EXISTS "Authenticated users can manage portals" ON public.client_portals;
CREATE POLICY "Authenticated users can manage portals" ON public.client_portals FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage portal questions" ON public.portal_initial_questions;
CREATE POLICY "Authenticated users can manage portal questions" ON public.portal_initial_questions FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage portal FAQs" ON public.portal_faqs;
CREATE POLICY "Authenticated users can manage portal FAQs" ON public.portal_faqs FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage portal materials" ON public.portal_materials;
CREATE POLICY "Authenticated users can manage portal materials" ON public.portal_materials FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage portal feedback" ON public.portal_feedback;
CREATE POLICY "Authenticated users can manage portal feedback" ON public.portal_feedback FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage portal comments" ON public.portal_comments;
CREATE POLICY "Authenticated users can manage portal comments" ON public.portal_comments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage timeline phases" ON public.portal_timeline_phases;
CREATE POLICY "Authenticated users can manage timeline phases" ON public.portal_timeline_phases FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage monthly summaries" ON public.portal_monthly_summaries;
CREATE POLICY "Authenticated users can manage monthly summaries" ON public.portal_monthly_summaries FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage portal project history" ON public.portal_project_history;
CREATE POLICY "Authenticated users can manage portal project history" ON public.portal_project_history FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== client_* tables =====
DROP POLICY IF EXISTS "Authenticated users can manage client_feedback" ON public.client_feedback;
CREATE POLICY "Authenticated users can manage client_feedback" ON public.client_feedback FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage client milestones" ON public.client_milestones;
CREATE POLICY "Authenticated users can manage client milestones" ON public.client_milestones FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage client NPS records" ON public.client_nps_records;
CREATE POLICY "Authenticated users can manage client NPS records" ON public.client_nps_records FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== CRM =====
DROP POLICY IF EXISTS "Authenticated users can manage pipelines" ON public.crm_pipelines;
CREATE POLICY "Authenticated users can manage pipelines" ON public.crm_pipelines FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage pipeline stages" ON public.crm_pipeline_stages;
CREATE POLICY "Authenticated users can manage pipeline stages" ON public.crm_pipeline_stages FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage pipeline leads" ON public.crm_pipeline_leads;
CREATE POLICY "Authenticated users can manage pipeline leads" ON public.crm_pipeline_leads FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage saved views" ON public.crm_saved_views;
CREATE POLICY "Authenticated users can manage saved views" ON public.crm_saved_views FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Commercial / strategy =====
DROP POLICY IF EXISTS "Authenticated users can manage strategy projects" ON public.commercial_strategy_projects;
CREATE POLICY "Authenticated users can manage strategy projects" ON public.commercial_strategy_projects FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Custom fields =====
DROP POLICY IF EXISTS "Authenticated users can manage custom_fields" ON public.custom_fields;
CREATE POLICY "Authenticated users can manage custom_fields" ON public.custom_fields FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage custom_field_values" ON public.custom_field_values;
CREATE POLICY "Authenticated users can manage custom_field_values" ON public.custom_field_values FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Financial / fiscal =====
DROP POLICY IF EXISTS "Authenticated users can manage financial goals" ON public.financial_goals;
CREATE POLICY "Authenticated users can manage financial goals" ON public.financial_goals FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage fiscal checks" ON public.fiscal_monthly_checks;
CREATE POLICY "Authenticated users can manage fiscal checks" ON public.fiscal_monthly_checks FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Meetings =====
DROP POLICY IF EXISTS "Authenticated users can manage meeting_projects" ON public.meeting_projects;
CREATE POLICY "Authenticated users can manage meeting_projects" ON public.meeting_projects FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Objectives =====
DROP POLICY IF EXISTS "Authenticated users can manage objective_actions" ON public.objective_actions;
CREATE POLICY "Authenticated users can manage objective_actions" ON public.objective_actions FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage objective_criteria" ON public.objective_criteria;
CREATE POLICY "Authenticated users can manage objective_criteria" ON public.objective_criteria FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage objective_metrics" ON public.objective_metrics;
CREATE POLICY "Authenticated users can manage objective_metrics" ON public.objective_metrics FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Products =====
DROP POLICY IF EXISTS "Authenticated users can manage product deliverable templates" ON public.product_deliverable_templates;
CREATE POLICY "Authenticated users can manage product deliverable templates" ON public.product_deliverable_templates FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product diagnostic questions" ON public.product_diagnostic_questions;
CREATE POLICY "Authenticated users can manage product diagnostic questions" ON public.product_diagnostic_questions FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product documents" ON public.product_documents;
CREATE POLICY "Authenticated users can manage product documents" ON public.product_documents FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product improvements" ON public.product_improvements;
CREATE POLICY "Authenticated users can manage product improvements" ON public.product_improvements FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product_milestones" ON public.product_milestones;
CREATE POLICY "Authenticated users can manage product_milestones" ON public.product_milestones FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product_nps_config" ON public.product_nps_config;
CREATE POLICY "Authenticated users can manage product_nps_config" ON public.product_nps_config FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product_nps_records" ON public.product_nps_records;
CREATE POLICY "Authenticated users can manage product_nps_records" ON public.product_nps_records FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product payment methods" ON public.product_payment_methods;
CREATE POLICY "Authenticated users can manage product payment methods" ON public.product_payment_methods FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product price tiers" ON public.product_price_tiers;
CREATE POLICY "Authenticated users can manage product price tiers" ON public.product_price_tiers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage product_team_members" ON public.product_team_members;
CREATE POLICY "Authenticated users can manage product_team_members" ON public.product_team_members FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== Projects =====
DROP POLICY IF EXISTS "Authenticated users can manage deliverables" ON public.project_deliverables;
CREATE POLICY "Authenticated users can manage deliverables" ON public.project_deliverables FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===== SOPs =====
DROP POLICY IF EXISTS "Authenticated users can manage sop_steps" ON public.sop_steps;
CREATE POLICY "Authenticated users can manage sop_steps" ON public.sop_steps FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage sop_step_documents" ON public.sop_step_documents;
CREATE POLICY "Authenticated users can manage sop_step_documents" ON public.sop_step_documents FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage onboarding items" ON public.sop_onboarding_items;
CREATE POLICY "Authenticated users can manage onboarding items" ON public.sop_onboarding_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage onboarding templates" ON public.sop_onboarding_templates;
CREATE POLICY "Authenticated users can manage onboarding templates" ON public.sop_onboarding_templates FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can manage offboarding items" ON public.sop_offboarding_items;
CREATE POLICY "Authenticated can manage offboarding items" ON public.sop_offboarding_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can manage offboarding templates" ON public.sop_offboarding_templates;
CREATE POLICY "Authenticated can manage offboarding templates" ON public.sop_offboarding_templates FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================================
-- STORAGE BUCKETS: lock down public listing
-- Keep public: logos (login bg), custom-fonts (CSS), portal-uploads (client portal w/o auth)
-- =========================================================
UPDATE storage.buckets SET public = false WHERE id IN (
  'brand-files',
  'commercial-files',
  'commercial-library',
  'content-files',
  'event-files',
  'meeting-files',
  'mural-files',
  'personal-images',
  'product-files',
  'project-files',
  'traffic-reports'
);
