-- Keep has_accountant in sync with accountant_member_id automatically
CREATE OR REPLACE FUNCTION public.sync_has_accountant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.has_accountant := NEW.accountant_member_id IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_has_accountant ON public.business_settings;
CREATE TRIGGER trg_sync_has_accountant
BEFORE INSERT OR UPDATE OF accountant_member_id, has_accountant
ON public.business_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_has_accountant();

-- Backfill any existing rows for consistency
UPDATE public.business_settings
SET accountant_member_id = accountant_member_id
WHERE has_accountant IS DISTINCT FROM (accountant_member_id IS NOT NULL);