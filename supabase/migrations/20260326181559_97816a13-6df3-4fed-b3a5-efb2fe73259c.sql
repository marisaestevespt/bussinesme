-- Add IBAN and payment_method to suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'transferencia';

-- Add recurring expense fields to financial_expenses
ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_day integer,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS parent_expense_id uuid REFERENCES public.financial_expenses(id);