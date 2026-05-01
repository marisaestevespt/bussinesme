-- ============ L7: MURAL HARDENING ============

-- 1) CHECK constraints
ALTER TABLE public.mural_posts
  DROP CONSTRAINT IF EXISTS mural_posts_category_check;
ALTER TABLE public.mural_posts
  ADD CONSTRAINT mural_posts_category_check
  CHECK (category IN ('anuncio','novidade','atualizacao','lembrete','outro'));

ALTER TABLE public.mural_reactions
  DROP CONSTRAINT IF EXISTS mural_reactions_emoji_check;
ALTER TABLE public.mural_reactions
  ADD CONSTRAINT mural_reactions_emoji_check
  CHECK (emoji IN ('👍','❤️','🎉','🙌'));

-- 2) updated_at em mural_comments
ALTER TABLE public.mural_comments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3) Triggers updated_at
DROP TRIGGER IF EXISTS update_mural_posts_updated_at ON public.mural_posts;
CREATE TRIGGER update_mural_posts_updated_at
  BEFORE UPDATE ON public.mural_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_mural_comments_updated_at ON public.mural_comments;
CREATE TRIGGER update_mural_comments_updated_at
  BEFORE UPDATE ON public.mural_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS — owner+admin para moderação
DROP POLICY IF EXISTS "Owners can delete mural posts" ON public.mural_posts;
DROP POLICY IF EXISTS "Authors and owners can update mural posts" ON public.mural_posts;

CREATE POLICY "Authors owners admins can update mural posts"
  ON public.mural_posts FOR UPDATE
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authors owners admins can delete mural posts"
  ON public.mural_posts FOR DELETE
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own comments" ON public.mural_comments;
CREATE POLICY "Authors owners admins can delete comments"
  ON public.mural_comments FOR DELETE
  USING (author_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authors can update own comments"
  ON public.mural_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());