
-- Table for moodboard + elementos images on Personalidade & Universo page
CREATE TABLE IF NOT EXISTS public.brand_personality_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('moodboard', 'element')),
  image_url TEXT NOT NULL,
  file_path TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_personality_images_kind ON public.brand_personality_images(kind, sort_order);

ALTER TABLE public.brand_personality_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand personality images" ON public.brand_personality_images
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand personality images" ON public.brand_personality_images
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand personality images" ON public.brand_personality_images
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand personality images" ON public.brand_personality_images
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_brand_personality_images_updated_at
  BEFORE UPDATE ON public.brand_personality_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add "Palavras que nos definem" and "Palavras que nos afastam" sections to Personalidade & Universo
DO $$
DECLARE
  v_item_id UUID;
  v_max_order INT;
BEGIN
  SELECT id INTO v_item_id FROM public.brand_kanban_items
   WHERE title = 'Personalidade & Universo' LIMIT 1;
  IF v_item_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(sort_order), -1) INTO v_max_order
    FROM public.brand_kanban_sections WHERE item_id = v_item_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.brand_kanban_sections
    WHERE item_id = v_item_id AND title = 'Palavras que nos definem'
  ) THEN
    INSERT INTO public.brand_kanban_sections (item_id, title, content, sort_order)
    VALUES (v_item_id, 'Palavras que nos definem', NULL, v_max_order + 1);
    v_max_order := v_max_order + 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.brand_kanban_sections
    WHERE item_id = v_item_id AND title = 'Palavras que nos afastam'
  ) THEN
    INSERT INTO public.brand_kanban_sections (item_id, title, content, sort_order)
    VALUES (v_item_id, 'Palavras que nos afastam', NULL, v_max_order + 1);
  END IF;
END $$;

-- Move Arquétipos out of the kanban grid (it now lives inside Personalidade & Universo page)
DELETE FROM public.brand_kanban_items WHERE title IN ('Arquétipos','Arquetipos');
