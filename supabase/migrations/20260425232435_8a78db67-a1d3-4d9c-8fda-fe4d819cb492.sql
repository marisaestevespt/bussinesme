CREATE OR REPLACE FUNCTION public.ensure_supplier_for_prestador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member RECORD;
  _existing_supplier_id uuid;
  _start_date date;
  _end_date date;
BEGIN
  IF NEW.contract_type IS DISTINCT FROM 'contrato_prestacao' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _existing_supplier_id
  FROM public.suppliers
  WHERE member_id = NEW.member_id
  LIMIT 1;

  IF _existing_supplier_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name, identification, email, whatsapp, iban, fiscal_address, payment_method
  INTO _member
  FROM public.team_members
  WHERE id = NEW.member_id;

  IF _member IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cast seguro de text -> date
  BEGIN
    _start_date := NULLIF(NEW.start_date::text, '')::date;
  EXCEPTION WHEN OTHERS THEN
    _start_date := NULL;
  END;
  BEGIN
    _end_date := NULLIF(NEW.end_date::text, '')::date;
  EXCEPTION WHEN OTHERS THEN
    _end_date := NULL;
  END;

  INSERT INTO public.suppliers (
    name, nif, email, phone, iban, address,
    category, payment_method, default_vat_rate,
    contract_start_date, contract_end_date,
    is_active, member_id
  ) VALUES (
    _member.full_name,
    _member.identification,
    _member.email,
    _member.whatsapp,
    _member.iban,
    _member.fiscal_address,
    'freelancer',
    _member.payment_method,
    23,
    _start_date,
    _end_date,
    true,
    NEW.member_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_supplier_for_prestador ON public.member_contracts;
CREATE TRIGGER trg_ensure_supplier_for_prestador
  AFTER INSERT OR UPDATE OF contract_type ON public.member_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_supplier_for_prestador();

-- BACKFILL com cast seguro
INSERT INTO public.suppliers (
  name, nif, email, phone, iban, address,
  category, payment_method, default_vat_rate,
  contract_start_date, contract_end_date,
  is_active, member_id
)
SELECT 
  tm.full_name,
  tm.identification,
  tm.email,
  tm.whatsapp,
  tm.iban,
  tm.fiscal_address,
  'freelancer',
  tm.payment_method,
  23,
  CASE WHEN mc.start_date ~ '^\d{4}-\d{2}-\d{2}' THEN mc.start_date::date ELSE NULL END,
  CASE WHEN mc.end_date ~ '^\d{4}-\d{2}-\d{2}' THEN mc.end_date::date ELSE NULL END,
  true,
  tm.id
FROM public.team_members tm
JOIN public.member_contracts mc ON mc.member_id = tm.id
LEFT JOIN public.suppliers s ON s.member_id = tm.id
WHERE mc.contract_type = 'contrato_prestacao'
  AND s.id IS NULL;