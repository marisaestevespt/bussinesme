
-- Add content_id to tasks table for linking tasks to content items
ALTER TABLE public.tasks
  ADD COLUMN content_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;
