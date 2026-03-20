
-- Table to store custom saved views for any page
CREATE TABLE public.custom_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  view_name TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  visible_columns TEXT[] DEFAULT '{}',
  sort_config JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own views"
ON public.custom_views FOR ALL
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE TRIGGER update_custom_views_updated_at
BEFORE UPDATE ON public.custom_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
