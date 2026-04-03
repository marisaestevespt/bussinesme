
CREATE TABLE public.channel_social_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL DEFAULT '',
  token_metadata JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id)
);

ALTER TABLE public.channel_social_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tokens"
  ON public.channel_social_tokens FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tokens"
  ON public.channel_social_tokens FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update tokens"
  ON public.channel_social_tokens FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete tokens"
  ON public.channel_social_tokens FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_channel_social_tokens_updated_at
  BEFORE UPDATE ON public.channel_social_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
