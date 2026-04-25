-- Phase B: Add icon (jsonb) + cover_url (text) to commercial/marketing entities

ALTER TABLE public.commercial_sales        ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.crm_leads               ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.crm_pipelines           ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.marketing_funnels       ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.marketing_automations   ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.traffic_creatives       ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.events                  ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.content_items           ADD COLUMN IF NOT EXISTS icon jsonb, ADD COLUMN IF NOT EXISTS cover_url text;