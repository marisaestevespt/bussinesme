CREATE OR REPLACE FUNCTION public.cleanup_tasks_on_content_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.tasks
  WHERE content_id = OLD.id
     OR (tag = 'Conteúdo' AND name LIKE '[Conteúdo] ' || OLD.title || '%');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_tasks_on_content_delete ON public.content_items;
CREATE TRIGGER trg_cleanup_tasks_on_content_delete
BEFORE DELETE ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.cleanup_tasks_on_content_delete();