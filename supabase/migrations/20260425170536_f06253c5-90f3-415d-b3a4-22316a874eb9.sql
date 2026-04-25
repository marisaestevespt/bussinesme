-- Fase C: adicionar icon (jsonb) e cover_url (text) a entidades financeiras, operacionais e de RH
ALTER TABLE public.financial_expenses   ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.financial_documents  ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.internal_documents   ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.tasks                ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.planning_routines    ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.routines             ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.departments          ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;