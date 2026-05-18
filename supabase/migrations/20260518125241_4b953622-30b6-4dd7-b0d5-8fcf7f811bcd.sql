-- Slim down supabase_realtime publication to only tables with truly live UX needs.
-- Everything else relies on React Query refetching, which is more than sufficient.

DO $$
DECLARE
  keep TEXT[] := ARRAY[
    'notifications',
    'tasks',
    'task_dependencies',
    'project_deliverables',
    'project_phases',
    'meetings',
    'meeting_participants',
    'meeting_projects',
    'mural_posts',
    'mural_comments',
    'mural_reactions',
    'content_items',
    'content_item_comments',
    'crm_pipeline_leads',
    'crm_pipeline_stages',
    'events',
    'event_members',
    'routines'
  ];
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename <> ALL(keep)
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
  END LOOP;
END $$;