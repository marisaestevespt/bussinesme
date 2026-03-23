
-- Create frequency enum
CREATE TYPE public.digest_frequency AS ENUM ('diario', 'semanal', 'mensal');

-- Create digest_settings table
CREATE TABLE public.digest_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_owner_digest BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency digest_frequency NOT NULL DEFAULT 'diario',
  send_time TIME NOT NULL DEFAULT '19:00',
  send_day_of_week INTEGER CHECK (send_day_of_week IS NULL OR (send_day_of_week >= 1 AND send_day_of_week <= 7)),
  send_day_of_month INTEGER CHECK (send_day_of_month IS NULL OR (send_day_of_month >= 1 AND send_day_of_month <= 31)),
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, is_owner_digest)
);

-- Enable RLS
ALTER TABLE public.digest_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own digest settings
CREATE POLICY "Users can read own digest settings"
  ON public.digest_settings FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Users can insert their own digest settings
CREATE POLICY "Users can insert own digest settings"
  ON public.digest_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Users can update their own digest settings
CREATE POLICY "Users can update own digest settings"
  ON public.digest_settings FOR UPDATE
  TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_digest_settings_updated_at
  BEFORE UPDATE ON public.digest_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
