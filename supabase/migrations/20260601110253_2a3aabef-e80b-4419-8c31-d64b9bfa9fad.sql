CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _raw text;
  _clean text;
  _tm_name text;
  _local text;
  _generic_locals text[] := ARRAY[
    'geral','info','contact','contacto','contactos','hello','ola','olá',
    'noreply','no-reply','admin','administracao','administração',
    'support','suporte','contabilidade','accounts','accounting','financeiro',
    'mail','email','contacta','equipa','team','office','escritorio','escritório'
  ];
BEGIN
  _raw := NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), '');

  -- 1. Prefer explicit metadata name (when it is not itself an email)
  IF _raw IS NOT NULL AND _raw !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    _clean := _raw;
  ELSE
    -- 2. If a team_members row already exists for this email, use its full_name
    SELECT full_name INTO _tm_name
      FROM public.team_members
      WHERE lower(email) = lower(NEW.email)
      LIMIT 1;

    IF _tm_name IS NOT NULL AND length(trim(_tm_name)) > 0 THEN
      _clean := _tm_name;
    ELSE
      -- 3. Fallback: derive from email local-part, but avoid generic mailbox words
      _local := lower(split_part(COALESCE(_raw, NEW.email), '@', 1));
      IF _local = ANY(_generic_locals) THEN
        -- Use the domain (without TLD) instead of a generic word like "geral"
        _clean := initcap(regexp_replace(split_part(split_part(NEW.email, '@', 2), '.', 1), '[._-]+', ' ', 'g'));
      ELSE
        _clean := initcap(regexp_replace(_local, '[._-]+', ' ', 'g'));
      END IF;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, _clean)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;