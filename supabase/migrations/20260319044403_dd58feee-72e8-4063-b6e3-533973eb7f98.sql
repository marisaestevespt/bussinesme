ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS vat_rate text DEFAULT '23' ,
  ADD COLUMN IF NOT EXISTS invoice_denomination text DEFAULT '' ,
  ADD COLUMN IF NOT EXISTS accounting_notes text DEFAULT '' ;