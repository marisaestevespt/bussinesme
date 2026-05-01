-- Trigger function: bloqueia inserir despesas individuais para fornecedores pausados/inativos.
-- Aplica-se apenas a:
--   * despesas com supplier_id (ignora impostos, ordenados, etc.)
--   * despesas que NÃO são a regra-mãe (is_recurring = false ou null)
-- A regra-mãe (template) pode existir mesmo com fornecedor pausado — é só um molde.

CREATE OR REPLACE FUNCTION public.block_expense_for_paused_supplier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active BOOLEAN;
  v_paused_until DATE;
  v_supplier_name TEXT;
BEGIN
  -- Sem fornecedor associado → nada a verificar
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A regra-mãe recorrente é só template; pode coexistir com pausa
  IF NEW.is_recurring = TRUE THEN
    RETURN NEW;
  END IF;

  SELECT is_active, paused_until, name
    INTO v_is_active, v_paused_until, v_supplier_name
    FROM public.suppliers
    WHERE id = NEW.supplier_id;

  -- Fornecedor não existe → deixar passar (constraint FK trata disto)
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_is_active = FALSE THEN
    RAISE EXCEPTION 'Não é possível criar despesas para o fornecedor "%" porque está inativo. Reativa o fornecedor primeiro.', v_supplier_name
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_paused_until IS NOT NULL AND v_paused_until > CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível criar despesas para o fornecedor "%" porque está pausado até %. Retoma o fornecedor primeiro.', v_supplier_name, v_paused_until
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_expense_for_paused_supplier ON public.financial_expenses;

CREATE TRIGGER trg_block_expense_for_paused_supplier
BEFORE INSERT ON public.financial_expenses
FOR EACH ROW
EXECUTE FUNCTION public.block_expense_for_paused_supplier();

COMMENT ON FUNCTION public.block_expense_for_paused_supplier() IS
'Proteção transversal: impede que qualquer fonte (cron, frontend, scripts) crie despesas individuais para fornecedores inativos ou pausados. Garante coerência mesmo se novos mecanismos de criação forem adicionados no futuro.';