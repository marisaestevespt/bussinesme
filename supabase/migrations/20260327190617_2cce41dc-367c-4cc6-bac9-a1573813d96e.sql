
-- Add subscription-like fields to financial_expenses for unified model
ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS periodicity text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renewal_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_equivalent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_name text DEFAULT NULL;

-- Add supplier_id to financial_subscriptions for migration reference
ALTER TABLE public.financial_subscriptions
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) DEFAULT NULL;
