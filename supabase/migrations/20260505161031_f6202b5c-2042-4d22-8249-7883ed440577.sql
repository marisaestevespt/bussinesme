-- 1. Add is_system flag to brand_kanban_items
ALTER TABLE public.brand_kanban_items ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Mark all existing items as system items
UPDATE public.brand_kanban_items SET is_system = true;

-- 2. Create sections table
CREATE TABLE IF NOT EXISTS public.brand_kanban_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.brand_kanban_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kanban_sections_item ON public.brand_kanban_sections(item_id, sort_order);

ALTER TABLE public.brand_kanban_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand kanban sections" ON public.brand_kanban_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand kanban sections" ON public.brand_kanban_sections
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand kanban sections" ON public.brand_kanban_sections
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand kanban sections" ON public.brand_kanban_sections
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_brand_kanban_sections_updated_at
  BEFORE UPDATE ON public.brand_kanban_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Migrate existing comma-separated content into section titles
DO $$
DECLARE
  rec RECORD;
  raw_text TEXT;
  parts TEXT[];
  part TEXT;
  idx INT;
BEGIN
  FOR rec IN SELECT id, content FROM public.brand_kanban_items WHERE content IS NOT NULL AND content <> '' LOOP
    -- Strip HTML tags and normalize
    raw_text := regexp_replace(rec.content, '<[^>]+>', '', 'g');
    raw_text := trim(raw_text);
    IF raw_text = '' THEN CONTINUE; END IF;
    parts := string_to_array(raw_text, ',');
    idx := 0;
    FOREACH part IN ARRAY parts LOOP
      part := trim(part);
      IF part <> '' THEN
        INSERT INTO public.brand_kanban_sections (item_id, title, content, sort_order)
        VALUES (rec.id, initcap(part), NULL, idx);
        idx := idx + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;