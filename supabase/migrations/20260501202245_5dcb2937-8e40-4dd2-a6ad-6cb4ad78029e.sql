-- Fechar lacunas de orfanidade detectadas
ALTER TABLE public.financial_subscriptions
  ADD CONSTRAINT financial_subscriptions_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.financial_contractors
  ADD CONSTRAINT financial_contractors_expense_id_fkey
  FOREIGN KEY (expense_id) REFERENCES public.financial_expenses(id) ON DELETE CASCADE;