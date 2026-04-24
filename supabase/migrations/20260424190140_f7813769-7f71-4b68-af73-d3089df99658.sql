-- Drop 41 dead tables (auditoria global). CASCADE handles FKs from child tables.
-- Order doesn't matter with CASCADE but we group logically for readability.

-- Legacy / substituted
DROP TABLE IF EXISTS public.financial_subscriptions CASCADE;
DROP TABLE IF EXISTS public.routines CASCADE;
DROP TABLE IF EXISTS public.department_links CASCADE;
DROP TABLE IF EXISTS public.portal_visits CASCADE;
DROP TABLE IF EXISTS public.marketing_monthly_analysis CASCADE;
DROP TABLE IF EXISTS public.crm_saved_views CASCADE;
DROP TABLE IF EXISTS public.custom_views CASCADE;
DROP TABLE IF EXISTS public.user_views CASCADE;

-- Product module orphans
DROP TABLE IF EXISTS public.product_costs CASCADE;
DROP TABLE IF EXISTS public.product_documents CASCADE;
DROP TABLE IF EXISTS public.product_feedbacks CASCADE;
DROP TABLE IF EXISTS public.product_funnels CASCADE;
DROP TABLE IF EXISTS public.product_improvements CASCADE;
DROP TABLE IF EXISTS public.product_milestones CASCADE;
DROP TABLE IF EXISTS public.product_kpi_reports CASCADE;
DROP TABLE IF EXISTS public.product_kpi_values CASCADE;
DROP TABLE IF EXISTS public.product_kpis CASCADE;
DROP TABLE IF EXISTS public.product_metrics_analysis CASCADE;
DROP TABLE IF EXISTS public.product_nps_records CASCADE;
DROP TABLE IF EXISTS public.product_payment_methods CASCADE;
DROP TABLE IF EXISTS public.product_team_members CASCADE;
DROP TABLE IF EXISTS public.product_traffic_ads CASCADE;
DROP TABLE IF EXISTS public.product_useful_links CASCADE;
DROP TABLE IF EXISTS public.product_automations CASCADE;
DROP TABLE IF EXISTS public.product_offboarding_templates CASCADE;

-- SOP / reports orphans
DROP TABLE IF EXISTS public.sop_offboarding_items CASCADE;
DROP TABLE IF EXISTS public.sop_offboarding_templates CASCADE;
DROP TABLE IF EXISTS public.sop_step_documents CASCADE;
DROP TABLE IF EXISTS public.traffic_report_files CASCADE;
DROP TABLE IF EXISTS public.traffic_report_cards CASCADE;
DROP TABLE IF EXISTS public.channel_reports CASCADE;

-- Other orphans
DROP TABLE IF EXISTS public.business_legal_documents CASCADE;
DROP TABLE IF EXISTS public.client_feedback CASCADE;
DROP TABLE IF EXISTS public.crm_pipeline_labels CASCADE;
DROP TABLE IF EXISTS public.custom_field_values CASCADE;
DROP TABLE IF EXISTS public.custom_fields CASCADE;
DROP TABLE IF EXISTS public.email_unsubscribe_tokens CASCADE;
DROP TABLE IF EXISTS public.marketing_channel_accounts CASCADE;
DROP TABLE IF EXISTS public.member_personal_images CASCADE;
DROP TABLE IF EXISTS public.suppressed_emails CASCADE;
DROP TABLE IF EXISTS public.fiscal_deadline_completions CASCADE;