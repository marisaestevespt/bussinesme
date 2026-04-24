
-- ============================================================
-- 1. Settings (singleton) — domínios permitidos, etc.
-- ============================================================
CREATE TABLE public.google_calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allowed_domains text[] NOT NULL DEFAULT '{}',
  sync_enabled boolean NOT NULL DEFAULT true,
  last_global_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir que só existe 1 linha
CREATE UNIQUE INDEX google_calendar_settings_singleton
  ON public.google_calendar_settings ((true));

-- Inserir linha singleton inicial
INSERT INTO public.google_calendar_settings (allowed_domains) VALUES ('{}');

ALTER TABLE public.google_calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settings"
  ON public.google_calendar_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins/owners can update settings"
  ON public.google_calendar_settings FOR UPDATE
  TO authenticated USING (public.is_admin_or_owner());

CREATE POLICY "Only admins/owners can insert settings"
  ON public.google_calendar_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_owner());

CREATE TRIGGER update_google_calendar_settings_updated_at
  BEFORE UPDATE ON public.google_calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Contas Google ligadas
-- ============================================================
CREATE TABLE public.google_calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  domain text NOT NULL,
  display_name text,
  -- Tokens (encriptados pelo Supabase Vault em produção; aqui guardados como text)
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  -- Webhook / push notifications
  watch_channel_id text,
  watch_resource_id text,
  watch_expiration timestamptz,
  -- Estado
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_error text,
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gcal_accounts_active ON public.google_calendar_accounts(is_active);
CREATE INDEX idx_gcal_accounts_domain ON public.google_calendar_accounts(domain);

ALTER TABLE public.google_calendar_accounts ENABLE ROW LEVEL SECURITY;

-- Membros podem ver email + display_name (não os tokens — tratado por views/edge functions)
CREATE POLICY "Authenticated can view accounts"
  ON public.google_calendar_accounts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins/owners can insert accounts"
  ON public.google_calendar_accounts FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Only admins/owners can update accounts"
  ON public.google_calendar_accounts FOR UPDATE
  TO authenticated USING (public.is_admin_or_owner());

CREATE POLICY "Only admins/owners can delete accounts"
  ON public.google_calendar_accounts FOR DELETE
  TO authenticated USING (public.is_admin_or_owner());

CREATE TRIGGER update_google_calendar_accounts_updated_at
  BEFORE UPDATE ON public.google_calendar_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Calendários individuais + mapeamento
-- ============================================================
CREATE TYPE public.google_calendar_scope AS ENUM (
  'produto',
  'cliente',
  'reunioes',
  'geral',
  'ignorar'
);

CREATE TABLE public.google_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.google_calendar_accounts(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,  -- ID do calendário no Google
  summary text NOT NULL,             -- Nome do calendário no Google
  description text,
  color_id text,                     -- Cor original do Google
  background_color text,             -- Hex color
  foreground_color text,
  is_primary boolean NOT NULL DEFAULT false,
  access_role text,                  -- owner, writer, reader
  -- Mapeamento Lyrata
  scope public.google_calendar_scope NOT NULL DEFAULT 'ignorar',
  mapped_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  mapped_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  -- Visibilidade na UI
  visible boolean NOT NULL DEFAULT true,
  -- Sync state
  sync_token text,                   -- Para incremental sync com Google
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, google_calendar_id)
);

CREATE INDEX idx_gcals_account ON public.google_calendars(account_id);
CREATE INDEX idx_gcals_scope ON public.google_calendars(scope);
CREATE INDEX idx_gcals_product ON public.google_calendars(mapped_product_id) WHERE mapped_product_id IS NOT NULL;
CREATE INDEX idx_gcals_client ON public.google_calendars(mapped_client_id) WHERE mapped_client_id IS NOT NULL;

ALTER TABLE public.google_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view calendars"
  ON public.google_calendars FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins/owners can insert calendars"
  ON public.google_calendars FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Only admins/owners can update calendars"
  ON public.google_calendars FOR UPDATE
  TO authenticated USING (public.is_admin_or_owner());

CREATE POLICY "Only admins/owners can delete calendars"
  ON public.google_calendars FOR DELETE
  TO authenticated USING (public.is_admin_or_owner());

CREATE TRIGGER update_google_calendars_updated_at
  BEFORE UPDATE ON public.google_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Mapa de eventos sincronizados (Lyrata ↔ Google)
-- ============================================================
CREATE TABLE public.google_calendar_event_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lado Lyrata: pode ser event ou meeting
  lyrata_event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  lyrata_meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  -- Lado Google
  google_calendar_db_id uuid NOT NULL REFERENCES public.google_calendars(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  google_etag text,                  -- Para detectar conflitos
  google_html_link text,
  meet_link text,
  -- Sync state
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_direction text,               -- 'lyrata_to_google' | 'google_to_lyrata' | 'both'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (google_calendar_db_id, google_event_id),
  -- Garantir que pelo menos um dos lados Lyrata está preenchido
  CONSTRAINT chk_lyrata_side CHECK (
    lyrata_event_id IS NOT NULL OR lyrata_meeting_id IS NOT NULL
  )
);

CREATE INDEX idx_gevent_sync_event ON public.google_calendar_event_sync(lyrata_event_id) WHERE lyrata_event_id IS NOT NULL;
CREATE INDEX idx_gevent_sync_meeting ON public.google_calendar_event_sync(lyrata_meeting_id) WHERE lyrata_meeting_id IS NOT NULL;
CREATE INDEX idx_gevent_sync_calendar ON public.google_calendar_event_sync(google_calendar_db_id);

ALTER TABLE public.google_calendar_event_sync ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler (necessário para a UI mostrar links de Meet, etc.)
CREATE POLICY "Authenticated can view sync"
  ON public.google_calendar_event_sync FOR SELECT
  TO authenticated USING (true);

-- Inserts/updates feitos pelas edge functions (service role) — utilizadores não escrevem diretamente
-- Mas permitimos a admins para casos manuais
CREATE POLICY "Admins can manage sync"
  ON public.google_calendar_event_sync FOR ALL
  TO authenticated USING (public.is_admin_or_owner())
  WITH CHECK (public.is_admin_or_owner());

CREATE TRIGGER update_google_calendar_event_sync_updated_at
  BEFORE UPDATE ON public.google_calendar_event_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Adicionar coluna a events para guardar o calendário Google de destino
--    (quando o evento é criado na Lyrata e depois sincronizado)
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN google_calendar_db_id uuid REFERENCES public.google_calendars(id) ON DELETE SET NULL,
  ADD COLUMN with_meet boolean NOT NULL DEFAULT false;

ALTER TABLE public.meetings
  ADD COLUMN google_calendar_db_id uuid REFERENCES public.google_calendars(id) ON DELETE SET NULL,
  ADD COLUMN with_meet boolean NOT NULL DEFAULT false;

CREATE INDEX idx_events_gcal ON public.events(google_calendar_db_id) WHERE google_calendar_db_id IS NOT NULL;
CREATE INDEX idx_meetings_gcal ON public.meetings(google_calendar_db_id) WHERE google_calendar_db_id IS NOT NULL;
