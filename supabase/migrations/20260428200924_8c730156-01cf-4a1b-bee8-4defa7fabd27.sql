
-- ───────────────────────────────────────────────────────────────────
-- SECURITY HARDENING ROUND 2 — revoke anon EXECUTE de funções internas
-- Mantém authenticated onde necessário (RLS helpers, RPCs de UI).
-- Revoga anon de TUDO exceto get_portal_* / portal_* (acesso público real).
-- ───────────────────────────────────────────────────────────────────

-- Helpers de RLS / contexto: authenticated SIM, anon NÃO
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(app_role[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_team_member_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_departments() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_sensitive_access(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_self_team_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_client(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accountant_access_enabled() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profiles_basic() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_system_config_value(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_entry(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_deliverable_assignee(uuid) FROM anon;

-- Operações sensíveis: revoga anon E PUBLIC (só authenticated)
REVOKE EXECUTE ON FUNCTION public.apply_project_deliverable_tasks(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backfill_deliverable_tasks() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rollback_renewal_project(uuid) FROM anon, PUBLIC;

-- ───────────────────────────────────────────────────────────────────
-- Test functions: só Owner pode correr. Revogar PUBLIC + adicionar guard.
-- ───────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.test_payment_sync_e2e() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.test_product_rename_cascade() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_payment_sync_e2e() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_product_rename_cascade() TO authenticated;

-- Wrap interno: garante que só Owner consegue executar os testes E2E
CREATE OR REPLACE FUNCTION public.run_e2e_tests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _payment_results jsonb;
  _product_results jsonb;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Apenas o Owner pode correr testes E2E';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'test_name', test_name,
    'expected', expected,
    'actual', actual,
    'passed', passed
  )) INTO _payment_results FROM public.test_payment_sync_e2e();

  SELECT jsonb_agg(jsonb_build_object(
    'test_name', table_name,
    'expected', expected,
    'actual', actual,
    'passed', passed
  )) INTO _product_results FROM public.test_product_rename_cascade();

  RETURN jsonb_build_object(
    'payment_sync', COALESCE(_payment_results, '[]'::jsonb),
    'product_rename', COALESCE(_product_results, '[]'::jsonb),
    'ran_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_e2e_tests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_e2e_tests() TO authenticated;
