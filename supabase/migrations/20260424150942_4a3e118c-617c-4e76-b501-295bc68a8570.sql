
DROP POLICY IF EXISTS "role_log_system_write" ON public.role_activity_log;
-- Sem policy de INSERT: apenas os triggers SECURITY DEFINER (log_role_change, log_access_suspension)
-- conseguem inserir, porque correm com privilégios do owner e bypassam RLS.
-- Isto remove o warning "RLS Policy Always True".
