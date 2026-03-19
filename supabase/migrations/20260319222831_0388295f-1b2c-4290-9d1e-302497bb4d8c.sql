-- Create recommendations table
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  impacted_area TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Members can only see their own recommendations
CREATE POLICY "Members can view own recommendations"
  ON public.recommendations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Owner can see all recommendations
CREATE POLICY "Owner can view all recommendations"
  ON public.recommendations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Authenticated users can insert their own
CREATE POLICY "Users can insert own recommendations"
  ON public.recommendations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own
CREATE POLICY "Users can delete own recommendations"
  ON public.recommendations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);