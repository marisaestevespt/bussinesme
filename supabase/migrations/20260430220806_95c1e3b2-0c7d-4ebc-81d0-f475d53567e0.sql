-- Re-affirm public state for image buckets (idempotent)
UPDATE storage.buckets SET public = true WHERE id IN ('personal-images','logos','entity-icons','custom-fonts');

-- Guard trigger: prevent these buckets from ever being made private
CREATE OR REPLACE FUNCTION public.enforce_public_image_buckets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NEW.id IN ('personal-images','logos','entity-icons','custom-fonts')
     AND NEW.public IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Bucket "%" must remain public — change blocked by safeguard.', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_public_image_buckets ON storage.buckets;
CREATE TRIGGER trg_enforce_public_image_buckets
  BEFORE UPDATE OR INSERT ON storage.buckets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_public_image_buckets();