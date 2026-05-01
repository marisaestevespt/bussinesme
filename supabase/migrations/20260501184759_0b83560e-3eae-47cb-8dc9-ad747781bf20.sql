CREATE OR REPLACE FUNCTION public.validate_recurring_child_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_rec record;
  supplier_rec record;
  months_diff integer;
  cycle_ok boolean;
BEGIN
  -- Apenas valida despesas-filhas geradas a partir de subscription
  IF NEW.source_type IS DISTINCT FROM 'subscription' OR NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, periodicity, renewal_date, expense_date, recurrence_day,
         recurrence_end_date, status, is_recurring, supplier_id, paused_until
  INTO parent_rec
  FROM public.financial_expenses
  WHERE id = NEW.source_id;

  IF NOT FOUND OR parent_rec.is_recurring IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- Bloqueios de materialização: só impedem criar novas despesas.
  -- Não devem impedir editar despesas existentes/histórico enquanto o fornecedor está pausado.
  IF TG_OP = 'INSERT' THEN
    IF parent_rec.status = 'cancelado' THEN
      RAISE EXCEPTION 'Não é possível materializar despesa: regra recorrente cancelada (id=%)', parent_rec.id
        USING ERRCODE = 'check_violation';
    END IF;

    IF parent_rec.paused_until IS NOT NULL AND CURRENT_DATE < parent_rec.paused_until THEN
      RAISE EXCEPTION 'Regra recorrente pausada até % (id=%)', parent_rec.paused_until, parent_rec.id
        USING ERRCODE = 'check_violation';
    END IF;

    IF parent_rec.supplier_id IS NOT NULL THEN
      SELECT id, is_active, paused_until INTO supplier_rec
      FROM public.suppliers WHERE id = parent_rec.supplier_id;

      IF FOUND AND supplier_rec.is_active = false THEN
        RAISE EXCEPTION 'Fornecedor inativo — não materializa despesas (supplier_id=%)', supplier_rec.id
          USING ERRCODE = 'check_violation';
      END IF;

      IF FOUND AND supplier_rec.paused_until IS NOT NULL AND CURRENT_DATE < supplier_rec.paused_until THEN
        RAISE EXCEPTION 'Fornecedor pausado até % (supplier_id=%)', supplier_rec.paused_until, supplier_rec.id
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  -- Bloquear se a recorrência terminou
  IF parent_rec.recurrence_end_date IS NOT NULL
     AND NEW.expense_date IS NOT NULL
     AND NEW.expense_date > parent_rec.recurrence_end_date THEN
    RAISE EXCEPTION 'Despesa após data fim de recorrência (% > %)',
      NEW.expense_date, parent_rec.recurrence_end_date
      USING ERRCODE = 'check_violation';
  END IF;

  -- Forçar parent_expense_id alinhado
  NEW.parent_expense_id := parent_rec.id;

  -- Validar alinhamento de período (anchor + periodicity)
  IF parent_rec.periodicity IS NOT NULL
     AND parent_rec.periodicity <> 'mensal'
     AND NEW.expense_month IS NOT NULL
     AND NEW.expense_year IS NOT NULL THEN
    DECLARE
      anchor date := COALESCE(parent_rec.renewal_date, parent_rec.expense_date);
    BEGIN
      IF anchor IS NOT NULL THEN
        months_diff := (NEW.expense_year - EXTRACT(YEAR FROM anchor)::int) * 12
                     + (NEW.expense_month - EXTRACT(MONTH FROM anchor)::int);
        cycle_ok := CASE parent_rec.periodicity
          WHEN 'bimestral'  THEN months_diff >= 0 AND months_diff % 2 = 0
          WHEN 'trimestral' THEN months_diff >= 0 AND months_diff % 3 = 0
          WHEN 'semestral'  THEN months_diff >= 0 AND months_diff % 6 = 0
          WHEN 'anual'      THEN months_diff >= 0 AND months_diff % 12 = 0
          ELSE true
        END;
        IF NOT cycle_ok THEN
          RAISE EXCEPTION 'Despesa fora do ciclo de recorrência (%, anchor=%, mês=%/%)',
            parent_rec.periodicity, anchor, NEW.expense_month, NEW.expense_year
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END;
  END IF;

  -- Forçar dia correto se recurrence_day definido
  IF parent_rec.recurrence_day IS NOT NULL AND NEW.expense_date IS NOT NULL THEN
    NEW.expense_date := make_date(
      EXTRACT(YEAR FROM NEW.expense_date)::int,
      EXTRACT(MONTH FROM NEW.expense_date)::int,
      LEAST(parent_rec.recurrence_day, 28)
    );
    NEW.expense_month := EXTRACT(MONTH FROM NEW.expense_date)::int;
    NEW.expense_quarter := CEIL(EXTRACT(MONTH FROM NEW.expense_date)::numeric / 3)::int;
    NEW.expense_year := EXTRACT(YEAR FROM NEW.expense_date)::int;
  END IF;

  RETURN NEW;
END;
$$;