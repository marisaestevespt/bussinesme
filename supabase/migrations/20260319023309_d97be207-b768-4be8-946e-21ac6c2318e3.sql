
-- Create storage bucket for traffic report files
INSERT INTO storage.buckets (id, name, public) VALUES ('traffic-reports', 'traffic-reports', true);

-- Storage RLS policies
CREATE POLICY "Authenticated can view traffic report files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'traffic-reports');
CREATE POLICY "Owners can upload traffic report files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'traffic-reports' AND public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete traffic report files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'traffic-reports' AND public.has_role(auth.uid(), 'owner'));

-- Table to track uploaded files per report card
CREATE TABLE public.traffic_report_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.traffic_report_cards(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_report_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view report files" ON public.traffic_report_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert report files" ON public.traffic_report_files FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete report files" ON public.traffic_report_files FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
