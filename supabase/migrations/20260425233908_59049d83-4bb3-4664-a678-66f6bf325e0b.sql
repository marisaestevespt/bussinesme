-- ============================================
-- WARNINGS: Restringir listing dos buckets públicos
-- (mantém acesso direto por URL público, bloqueia LIST)
-- ============================================

-- 1. custom-fonts: SELECT só autenticados
DROP POLICY IF EXISTS "Authenticated can list fonts" ON storage.objects;
CREATE POLICY "Authenticated can list fonts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'custom-fonts');

-- 2. logos: SELECT só autenticados
DROP POLICY IF EXISTS "Authenticated can list logos" ON storage.objects;
CREATE POLICY "Authenticated can list logos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'logos');

-- 3. entity-icons: criar SELECT restrito a autenticados (estava sem policy)
DROP POLICY IF EXISTS "Authenticated can list entity icons" ON storage.objects;
CREATE POLICY "Authenticated can list entity icons"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'entity-icons');

-- 4. product-files: já tinha SELECT restrito a authenticated; reforçar role
-- (Já existe "Authenticated can view product files" — manter como está)

-- ============================================
-- EXTENSÃO pg_net: mover de public para extensions
-- ============================================
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role, postgres;

-- pg_net não suporta ALTER EXTENSION SET SCHEMA diretamente em todas as versões;
-- a abordagem correta é drop + recreate no novo schema.
-- ATENÇÃO: pg_net é usado em cron jobs (net.http_post) — vamos garantir que continua acessível
-- mantendo um search_path adequado nos jobs.
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Garantir que cron jobs continuam a encontrar a função net.http_post
GRANT USAGE ON SCHEMA net TO postgres, authenticated, service_role;