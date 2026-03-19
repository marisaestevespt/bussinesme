
-- Strategy page tables

-- 1. strategy_settings: foco text and posicionamento text
CREATE TABLE public.strategy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view strategy_settings" ON public.strategy_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert strategy_settings" ON public.strategy_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update strategy_settings" ON public.strategy_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- 2. strategy_editorial_lines: pilar, descricao, tipos_conteudo
CREATE TABLE public.strategy_editorial_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilar text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  tipos_conteudo text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_editorial_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view editorial lines" ON public.strategy_editorial_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert editorial lines" ON public.strategy_editorial_lines FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update editorial lines" ON public.strategy_editorial_lines FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete editorial lines" ON public.strategy_editorial_lines FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- 3. strategy_distribution_cards: kanban cards for weekday distribution
CREATE TABLE public.strategy_distribution_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL,
  title text NOT NULL DEFAULT '',
  channel text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_distribution_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view distribution cards" ON public.strategy_distribution_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert distribution cards" ON public.strategy_distribution_cards FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update distribution cards" ON public.strategy_distribution_cards FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete distribution cards" ON public.strategy_distribution_cards FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- 4. strategy_channel_details: per-channel strategy details
CREATE TABLE public.strategy_channel_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  positioning text,
  periodicity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id)
);
ALTER TABLE public.strategy_channel_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view channel details" ON public.strategy_channel_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert channel details" ON public.strategy_channel_details FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update channel details" ON public.strategy_channel_details FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- 5. strategy_channel_formats: format/objective table per channel
CREATE TABLE public.strategy_channel_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  formato text NOT NULL DEFAULT '',
  objetivo text NOT NULL DEFAULT '',
  exemplos text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_channel_formats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view channel formats" ON public.strategy_channel_formats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert channel formats" ON public.strategy_channel_formats FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update channel formats" ON public.strategy_channel_formats FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete channel formats" ON public.strategy_channel_formats FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- 6. strategy_channel_frames: quadros fixos per channel
CREATE TABLE public.strategy_channel_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  formato text NOT NULL DEFAULT '',
  frequencia text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.strategy_channel_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view channel frames" ON public.strategy_channel_frames FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert channel frames" ON public.strategy_channel_frames FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update channel frames" ON public.strategy_channel_frames FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete channel frames" ON public.strategy_channel_frames FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
