DROP TRIGGER IF EXISTS trg_enforce_lead_conversion_on_won ON public.crm_leads;
DROP FUNCTION IF EXISTS public.enforce_lead_conversion_on_won();