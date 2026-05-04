-- Drop sensitive tables from the realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_payroll;
ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_documents;
ALTER PUBLICATION supabase_realtime DROP TABLE public.team_members;
ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_expenses;
ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_goals;
ALTER PUBLICATION supabase_realtime DROP TABLE public.commercial_sales;
ALTER PUBLICATION supabase_realtime DROP TABLE public.clients;
ALTER PUBLICATION supabase_realtime DROP TABLE public.system_config;
ALTER PUBLICATION supabase_realtime DROP TABLE public.member_contracts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_subscriptions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.performance_monthly;
ALTER PUBLICATION supabase_realtime DROP TABLE public.feedback_sessions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.email_send_state;
ALTER PUBLICATION supabase_realtime DROP TABLE public.performance_weekly;
ALTER PUBLICATION supabase_realtime DROP TABLE public.member_payments;
ALTER PUBLICATION supabase_realtime DROP TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_contractors;
ALTER PUBLICATION supabase_realtime DROP TABLE public.page_access_grants;
ALTER PUBLICATION supabase_realtime DROP TABLE public.member_onboarding;

-- Reinforce accountant access gate with a system-level toggle
CREATE OR REPLACE FUNCTION public.accountant_access_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- 1. system-level toggle must be enabled (defaults to true if key missing,
    --    so existing deployments keep working; owners can disable globally)
    COALESCE(
      (SELECT (value::text)::boolean FROM public.system_config WHERE key = 'accountant_access_enabled' LIMIT 1),
      true
    )
    -- 2. AND the calling user's team_member record must not be suspended
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE p.user_id = auth.uid() AND tm.access_suspended = true
    )
$function$;