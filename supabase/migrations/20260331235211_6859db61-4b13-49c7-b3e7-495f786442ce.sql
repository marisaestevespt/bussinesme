ALTER TABLE public.member_contracts
  ADD COLUMN value_includes_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN payment_start_date date,
  ADD COLUMN use_custom_payment_start boolean NOT NULL DEFAULT false;