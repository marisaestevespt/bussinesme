-- 1. Limpar os 7 duplicados existentes: as "regras" estavam com mês/ano preenchidos
--    Mantemos a regra como template puro (NULL no mês/ano/data), preservando o seu id (referenciado por filhos)
UPDATE public.financial_expenses
SET expense_year = NULL,
    expense_month = NULL,
    expense_quarter = NULL,
    expense_date = NULL
WHERE source_type = 'rule'
  AND is_recurring = true;

-- 2. Trigger de validação: regras NUNCA podem ter mês/ano preenchidos
CREATE OR REPLACE FUNCTION public.validate_recurring_rule_no_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.source_type = 'rule' AND NEW.is_recurring = true THEN
    -- Regras são templates: limpamos qualquer tentativa de definir mês/ano
    NEW.expense_year := NULL;
    NEW.expense_month := NULL;
    NEW.expense_quarter := NULL;
    NEW.expense_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_recurring_rule_no_period ON public.financial_expenses;
CREATE TRIGGER trg_validate_recurring_rule_no_period
  BEFORE INSERT OR UPDATE ON public.financial_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_recurring_rule_no_period();

-- 3. Índice único de defesa em profundidade:
--    Para qualquer despesa NÃO-regra com fornecedor+mês+ano, só pode haver UMA linha por valor.
--    (Aceita várias linhas só se forem valores diferentes — útil para casos legítimos como acertos.)
CREATE UNIQUE INDEX IF NOT EXISTS financial_expenses_supplier_month_value_uq
  ON public.financial_expenses (supplier_id, expense_year, expense_month, total_with_vat)
  WHERE supplier_id IS NOT NULL
    AND expense_year IS NOT NULL
    AND expense_month IS NOT NULL
    AND (source_type IS DISTINCT FROM 'rule')
    AND status <> 'cancelado';
