CREATE TABLE public.brand_content_pillars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_content_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view content pillars"
ON public.brand_content_pillars FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Owner can insert content pillars"
ON public.brand_content_pillars FOR INSERT
TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can update content pillars"
ON public.brand_content_pillars FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owner can delete content pillars"
ON public.brand_content_pillars FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_brand_content_pillars_updated_at
BEFORE UPDATE ON public.brand_content_pillars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();