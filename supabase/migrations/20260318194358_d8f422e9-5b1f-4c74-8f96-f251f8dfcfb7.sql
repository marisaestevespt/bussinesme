
-- Storage bucket for event files
INSERT INTO storage.buckets (id, name, public) VALUES ('event-files', 'event-files', true);

-- RLS for event-files bucket
CREATE POLICY "Authenticated can upload event files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-files');

CREATE POLICY "Anyone can view event files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-files');

CREATE POLICY "Owners can delete event files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-files' AND public.has_role(auth.uid(), 'owner'::app_role));

-- Event attachments (files + links)
CREATE TABLE public.event_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'link')),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.event_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event attachments" ON public.event_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert event attachments" ON public.event_attachments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Owners can delete event attachments" ON public.event_attachments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));

-- Event members (link events to profiles)
CREATE TABLE public.event_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event members" ON public.event_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert event members" ON public.event_members
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Owners can delete event members" ON public.event_members
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role));
