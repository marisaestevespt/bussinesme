
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _raw text;
  _clean text;
BEGIN
  _raw := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');
  -- If full_name looks like an email or is missing, derive from email local-part
  IF _raw IS NULL OR _raw ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    _clean := split_part(COALESCE(_raw, NEW.email), '@', 1);
    _clean := regexp_replace(_clean, '[._-]+', ' ', 'g');
    _clean := initcap(_clean);
  ELSE
    _clean := _raw;
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, _clean)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill existing profiles whose full_name is an email
UPDATE public.profiles
SET full_name = initcap(regexp_replace(split_part(full_name, '@', 1), '[._-]+', ' ', 'g'))
WHERE full_name ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';
