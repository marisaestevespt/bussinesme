-- Cria índices em todas as FKs públicas que ainda não os têm.
-- Idempotente: pode ser executado várias vezes sem efeito duplicado.
DO $$
DECLARE
  r RECORD;
  idx_name TEXT;
BEGIN
  FOR r IN
    WITH fks AS (
      SELECT
        c.conrelid::regclass::text AS table_name,
        a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
        AND array_length(c.conkey, 1) = 1  -- só FKs de coluna única
    ),
    indexed AS (
      SELECT t.relname AS table_name, a.attname AS column_name
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = 'public' AND a.attnum = ix.indkey[0]
    )
    SELECT fks.table_name, fks.column_name
    FROM fks
    LEFT JOIN indexed i ON i.table_name = fks.table_name AND i.column_name = fks.column_name
    WHERE i.column_name IS NULL
  LOOP
    -- Nome do índice: idx_<tabela>_<coluna>, truncado a 63 chars (limite Postgres)
    idx_name := left('idx_' || replace(r.table_name, '.', '_') || '_' || r.column_name, 63);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (%I)',
      idx_name, r.table_name, r.column_name
    );
  END LOOP;
END
$$;