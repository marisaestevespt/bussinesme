
-- Add proposta_unica_valor to business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS proposta_unica_valor text;

-- Brand links (folders and shortcuts)
CREATE TABLE public.brand_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'folder',
  label text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand links" ON public.brand_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand links" ON public.brand_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand links" ON public.brand_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand links" ON public.brand_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Brand kanban items
CREATE TABLE public.brand_kanban_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key text NOT NULL,
  title text NOT NULL,
  content text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_kanban_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand kanban items" ON public.brand_kanban_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand kanban items" ON public.brand_kanban_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand kanban items" ON public.brand_kanban_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand kanban items" ON public.brand_kanban_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Brand visual cards
CREATE TABLE public.brand_visual_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_visual_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand visual cards" ON public.brand_visual_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand visual cards" ON public.brand_visual_cards FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand visual cards" ON public.brand_visual_cards FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand visual cards" ON public.brand_visual_cards FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Brand visual files
CREATE TABLE public.brand_visual_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.brand_visual_cards(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'file',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_visual_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand visual files" ON public.brand_visual_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand visual files" ON public.brand_visual_files FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand visual files" ON public.brand_visual_files FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Storage bucket for brand files
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-files', 'brand-files', true);

CREATE POLICY "Authenticated can view brand files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'brand-files');
CREATE POLICY "Owners can upload brand files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-files' AND public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-files' AND public.has_role(auth.uid(), 'owner'));

-- Seed default kanban items
INSERT INTO public.brand_kanban_items (group_key, title, sort_order) VALUES
  ('marca_pessoal', 'O meu propósito', 0),
  ('marca_pessoal', 'Missão Visão e Valores', 1),
  ('marca_pessoal', 'História de Criação', 2),
  ('mercado', 'Concorrência', 0),
  ('mercado', 'Análise SWOT', 1),
  ('mercado', 'Diferenciais', 2),
  ('posicionamento', 'Público Alvo e Persona', 0),
  ('posicionamento', 'Proposta de Valor', 1),
  ('identidade', 'Como ser e não ser vista', 0),
  ('identidade', 'Sentimentos a gerar', 1),
  ('identidade', 'Tom de voz e Linguagem', 2),
  ('identidade', 'Palavras Sagradas', 3),
  ('identidade', 'Sistema de Crenças', 4),
  ('identidade', 'Rituais', 5),
  ('identidade', 'Ícones', 6),
  ('identidade', 'Inimigo Comum', 7),
  ('identidade', 'Personalidade e Universo', 8),
  ('impacto', 'Movimento de Marca', 0),
  ('impacto', 'Manifesto', 1),
  ('impacto', 'Transformação', 2),
  ('impacto', 'Convite', 3);

-- Seed default visual cards
INSERT INTO public.brand_visual_cards (title, sort_order) VALUES
  ('Logotipos', 0),
  ('Paleta de Cores', 1),
  ('Tipografia', 2),
  ('Moodboard', 3),
  ('Texturas e Padrões', 4),
  ('Estilo Gráfico', 5),
  ('Ícones e Elementos', 6);
