-- Add new columns to feedback_sessions for richer session data
ALTER TABLE public.feedback_sessions
  ADD COLUMN IF NOT EXISTS session_time text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS transcript_url text,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Create event type for feedback sessions if not exists
INSERT INTO public.event_types (id, name, slug, color)
VALUES (gen_random_uuid(), 'Sessão de Feedback', 'sessao_feedback', '#8B5CF6')
ON CONFLICT DO NOTHING;