DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT LIKE 'pg\_%'
  LOOP
    -- Set replica identity full so realtime payloads include all columns
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', r.tablename);
    EXCEPTION WHEN others THEN NULL;
    END;

    -- Add to realtime publication if not already a member
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables pt
      WHERE pt.pubname = 'supabase_realtime'
        AND pt.schemaname = 'public'
        AND pt.tablename = r.tablename
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', r.tablename);
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;