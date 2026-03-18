
-- Meeting status enum
CREATE TYPE public.meeting_status AS ENUM ('por_confirmar', 'marcada', 'terminada');

-- Meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  status public.meeting_status NOT NULL DEFAULT 'por_confirmar',
  client_name TEXT,
  project_name TEXT,
  transcript_url TEXT,
  -- Structured minutes (ata) stored as JSONB
  discussion_points JSONB DEFAULT '[]'::jsonb,
  priorities JSONB DEFAULT '["","","","",""]'::jsonb,
  owner_actions JSONB DEFAULT '[]'::jsonb,
  client_actions JSONB DEFAULT '[]'::jsonb,
  final_notes JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view meetings" ON public.meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert meetings" ON public.meetings
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update meetings" ON public.meetings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Owners can delete meetings" ON public.meetings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Meeting participants
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, profile_id)
);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view meeting participants" ON public.meeting_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert meeting participants" ON public.meeting_participants
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can delete meeting participants" ON public.meeting_participants
  FOR DELETE TO authenticated USING (true);

-- Storage bucket for meeting transcripts
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-files', 'meeting-files', true);

CREATE POLICY "Authenticated can upload meeting files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meeting-files');

CREATE POLICY "Anyone authenticated can view meeting files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-files');
