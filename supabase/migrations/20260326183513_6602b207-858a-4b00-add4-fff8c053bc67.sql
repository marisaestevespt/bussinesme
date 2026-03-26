
-- Add project_id to commercial_library_entries for revenue tracking
ALTER TABLE public.commercial_library_entries
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add launch_id to content_items to link content to launches
ALTER TABLE public.content_items
  ADD COLUMN launch_id uuid REFERENCES public.commercial_library_entries(id) ON DELETE SET NULL;
