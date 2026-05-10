ALTER TABLE public.clients
  DROP COLUMN IF EXISTS contract_value,
  DROP COLUMN IF EXISTS current_quote_id;