
CREATE TABLE public.content_item_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES public.content_item_comments(id) ON DELETE CASCADE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_item_comments_item ON public.content_item_comments(content_item_id);
CREATE INDEX idx_content_item_comments_parent ON public.content_item_comments(parent_id);

ALTER TABLE public.content_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comments"
  ON public.content_item_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can create comments"
  ON public.content_item_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own comments"
  ON public.content_item_comments FOR UPDATE
  TO authenticated USING (auth.uid() = author_id);

CREATE POLICY "Authors or owner can delete comments"
  ON public.content_item_comments FOR DELETE
  TO authenticated USING (
    auth.uid() = author_id OR public.has_role(auth.uid(), 'owner'::app_role)
  );

CREATE TRIGGER trg_content_item_comments_updated_at
  BEFORE UPDATE ON public.content_item_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.content_item_comments;
