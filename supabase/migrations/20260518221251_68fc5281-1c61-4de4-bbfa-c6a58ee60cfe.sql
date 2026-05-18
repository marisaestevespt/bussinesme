-- Bloco F: limpar warnings do linter sobre SECURITY DEFINER functions
-- 
-- Estratégia:
-- 1. Funções de trigger (return trigger) nunca precisam de EXECUTE para roles do API.
--    Os triggers correm sempre como dono da tabela, independentemente de grants.
--    → REVOKE EXECUTE FROM anon, authenticated, PUBLIC em todas.
-- 2. Funções não-trigger: revogar de anon (nenhuma RPC deve ser chamada sem auth).
--    Mantém-se EXECUTE para authenticated nas que são genuinamente RPCs.

DO $$
DECLARE
  fn record;
BEGIN
  -- 1) Trigger functions: revoke from all API roles
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND t.typname = 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, PUBLIC', fn.sig);
  END LOOP;

  -- 2) Non-trigger SECURITY DEFINER functions: revoke from anon
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND t.typname <> 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', fn.sig);
  END LOOP;
END $$;