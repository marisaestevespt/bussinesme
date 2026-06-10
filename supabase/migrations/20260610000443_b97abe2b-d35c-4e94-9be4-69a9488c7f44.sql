GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_item_comments TO authenticated;
GRANT ALL ON TABLE public.content_item_comments TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;