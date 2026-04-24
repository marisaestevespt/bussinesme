-- Reposição de 41 tabelas eliminadas indevidamente.
-- Estrutura recuperada das migrations originais. RLS policies originais incluídas.

-- ========== financial_subscriptions ==========
CREATE TABLE IF NOT EXISTS public.financial_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  value numeric NOT NULL DEFAULT 0,
  periodicity text NOT NULL DEFAULT 'mensal',
  monthly_equivalent numeric NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'portugal',
  start_date date NULL,
  renewal_date date NULL,
  status text NOT NULL DEFAULT 'ativo',
  notes text NULL,
  created_by uuid NULL,
  supplier_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages financial_subscriptions" ON public.financial_subscriptions FOR ALL TO authenticated USING (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values')) WITH CHECK (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));

-- ========== routines ==========
CREATE TABLE IF NOT EXISTS public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'todos_os_dias',
  department text NOT NULL DEFAULT 'administrativo',
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage routines" ON public.routines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== department_links ==========
CREATE TABLE IF NOT EXISTS public.department_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  link_type text NOT NULL,
  label text,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.department_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read department_links" ON public.department_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_admin write department_links" ON public.department_links FOR ALL TO authenticated USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));

-- ========== portal_visits ==========
CREATE TABLE IF NOT EXISTS public.portal_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  email text NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon log visit for active portals" ON public.portal_visits FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.client_portals cp WHERE cp.id = portal_visits.portal_id AND cp.is_active = true));
CREATE POLICY "Owner admin view portal_visits" ON public.portal_visits FOR SELECT TO authenticated USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));

-- ========== marketing_monthly_analysis ==========
CREATE TABLE IF NOT EXISTS public.marketing_monthly_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  what_went_well text,
  what_went_wrong text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);
ALTER TABLE public.marketing_monthly_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage marketing_monthly_analysis" ON public.marketing_monthly_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== crm_saved_views ==========
CREATE TABLE IF NOT EXISTS public.crm_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage crm_saved_views" ON public.crm_saved_views FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== custom_views ==========
CREATE TABLE IF NOT EXISTS public.custom_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  page_key text NOT NULL,
  name text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage custom_views" ON public.custom_views FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== user_views ==========
CREATE TABLE IF NOT EXISTS public.user_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  label text NOT NULL,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own user_views" ON public.user_views FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ========== product_costs ==========
CREATE TABLE IF NOT EXISTS public.product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  cost_name text NOT NULL,
  cost_value numeric DEFAULT 0,
  cost_type text DEFAULT 'fixo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_costs" ON public.product_costs FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_documents ==========
CREATE TABLE IF NOT EXISTS public.product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  document_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_documents" ON public.product_documents FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_feedbacks ==========
CREATE TABLE IF NOT EXISTS public.product_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  client_name text,
  feedback_text text,
  rating integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_feedbacks" ON public.product_feedbacks FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_funnels ==========
CREATE TABLE IF NOT EXISTS public.product_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  funnel_type text,
  description text,
  conversion_rate numeric,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_funnels" ON public.product_funnels FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_improvements ==========
CREATE TABLE IF NOT EXISTS public.product_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pendente',
  priority text DEFAULT 'media',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_improvements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_improvements" ON public.product_improvements FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_milestones ==========
CREATE TABLE IF NOT EXISTS public.product_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  milestone text NOT NULL DEFAULT '',
  milestone_type text NOT NULL DEFAULT 'check_in',
  days_after_start integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_milestones" ON public.product_milestones FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_kpi_reports ==========
CREATE TABLE IF NOT EXISTS public.product_kpi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  report_month integer,
  report_year integer,
  summary text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_kpi_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_kpi_reports" ON public.product_kpi_reports FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_kpi_values ==========
CREATE TABLE IF NOT EXISTS public.product_kpi_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  period_label text,
  value numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_kpi_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_kpi_values" ON public.product_kpi_values FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_kpis ==========
CREATE TABLE IF NOT EXISTS public.product_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  target_value numeric,
  description text,
  category text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_kpis" ON public.product_kpis FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_metrics_analysis ==========
CREATE TABLE IF NOT EXISTS public.product_metrics_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  month integer,
  year integer,
  what_went_well text,
  what_went_wrong text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_metrics_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_metrics_analysis" ON public.product_metrics_analysis FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_nps_records ==========
CREATE TABLE IF NOT EXISTS public.product_nps_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  client_name text,
  collection_date date NOT NULL DEFAULT CURRENT_DATE,
  nps_score integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_nps_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_nps_records" ON public.product_nps_records FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_payment_methods ==========
CREATE TABLE IF NOT EXISTS public.product_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  method text NOT NULL,
  notes text
);
ALTER TABLE public.product_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_payment_methods" ON public.product_payment_methods FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_team_members ==========
CREATE TABLE IF NOT EXISTS public.product_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  member_id uuid,
  role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_team_members" ON public.product_team_members FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_traffic_ads ==========
CREATE TABLE IF NOT EXISTS public.product_traffic_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  ad_name text NOT NULL,
  platform text,
  budget numeric,
  status text DEFAULT 'ativo',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_traffic_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_traffic_ads" ON public.product_traffic_ads FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_useful_links ==========
CREATE TABLE IF NOT EXISTS public.product_useful_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_useful_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_useful_links" ON public.product_useful_links FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_automations ==========
CREATE TABLE IF NOT EXISTS public.product_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger text,
  status text DEFAULT 'ativo',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_automations" ON public.product_automations FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== product_offboarding_templates ==========
CREATE TABLE IF NOT EXISTS public.product_offboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  responsible_type text,
  is_meeting boolean DEFAULT false,
  deliverable_type text DEFAULT 'tarefa',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_offboarding_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage product_offboarding_templates" ON public.product_offboarding_templates FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== sop_offboarding_templates ==========
CREATE TABLE IF NOT EXISTS public.sop_offboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid,
  role_title text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_offboarding_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sop_offboarding_templates" ON public.sop_offboarding_templates FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== sop_offboarding_items ==========
CREATE TABLE IF NOT EXISTS public.sop_offboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.sop_offboarding_templates(id) ON DELETE CASCADE,
  task text NOT NULL,
  deadline_days integer DEFAULT 7,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_offboarding_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sop_offboarding_items" ON public.sop_offboarding_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== sop_step_documents ==========
CREATE TABLE IF NOT EXISTS public.sop_step_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid,
  sop_id uuid,
  file_name text NOT NULL,
  file_url text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_step_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sop_step_documents" ON public.sop_step_documents FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== traffic_report_cards ==========
CREATE TABLE IF NOT EXISTS public.traffic_report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid,
  product_id uuid,
  card_type text,
  title text,
  data jsonb DEFAULT '{}'::jsonb,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_report_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage traffic_report_cards" ON public.traffic_report_cards FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== traffic_report_files ==========
CREATE TABLE IF NOT EXISTS public.traffic_report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES public.traffic_report_cards(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_report_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage traffic_report_files" ON public.traffic_report_files FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== channel_reports ==========
CREATE TABLE IF NOT EXISTS public.channel_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid,
  report_month integer,
  report_year integer,
  data jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage channel_reports" ON public.channel_reports FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== business_legal_documents ==========
CREATE TABLE IF NOT EXISTS public.business_legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,
  file_name text,
  file_url text,
  notes text,
  expires_at date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_admin manage business_legal_documents" ON public.business_legal_documents FOR ALL TO authenticated USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));

-- ========== client_feedback ==========
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  feedback_text text,
  rating integer,
  feedback_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage client_feedback" ON public.client_feedback FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== crm_pipeline_labels ==========
CREATE TABLE IF NOT EXISTS public.crm_pipeline_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid,
  label_name text NOT NULL,
  color text DEFAULT '#888888'
);
ALTER TABLE public.crm_pipeline_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage crm_pipeline_labels" ON public.crm_pipeline_labels FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== custom_fields ==========
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb,
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage custom_fields" ON public.custom_fields FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== custom_field_values ==========
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  value_text text,
  value_number numeric,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage custom_field_values" ON public.custom_field_values FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== email_unsubscribe_tokens ==========
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read email_unsubscribe_tokens" ON public.email_unsubscribe_tokens FOR SELECT TO authenticated USING (has_role(auth.uid(),'owner'));

-- ========== marketing_channel_accounts ==========
CREATE TABLE IF NOT EXISTS public.marketing_channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid,
  account_handle text NOT NULL,
  account_url text,
  responsible_member_id uuid,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_channel_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage marketing_channel_accounts" ON public.marketing_channel_accounts FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========== member_personal_images ==========
CREATE TABLE IF NOT EXISTS public.member_personal_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid,
  image_url text NOT NULL,
  notes text
);
ALTER TABLE public.member_personal_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self manage member_personal_images" ON public.member_personal_images FOR ALL TO authenticated USING (is_self_team_member(member_id)) WITH CHECK (is_self_team_member(member_id));

-- ========== suppressed_emails ==========
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text,
  suppressed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage suppressed_emails" ON public.suppressed_emails FOR ALL TO authenticated USING (has_role(auth.uid(),'owner')) WITH CHECK (has_role(auth.uid(),'owner'));

-- ========== fiscal_deadline_completions ==========
CREATE TABLE IF NOT EXISTS public.fiscal_deadline_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_key text NOT NULL,
  completion_date date,
  notes text,
  completed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_deadline_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage fiscal_deadline_completions" ON public.fiscal_deadline_completions FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);