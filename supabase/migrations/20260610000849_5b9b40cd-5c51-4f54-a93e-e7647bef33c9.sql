ALTER TABLE public.content_item_comments
  DROP CONSTRAINT IF EXISTS content_item_comments_author_id_fkey;

ALTER TABLE public.content_item_comments
  ADD CONSTRAINT content_item_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;