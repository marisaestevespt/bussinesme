
-- 1. Departments reference table
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text UNIQUE NOT NULL,
  label text NOT NULL,
  gradient text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  lucide_icon text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read departments" ON public.departments FOR SELECT TO authenticated USING (true);

-- 2. SOP categories reference table
CREATE TABLE IF NOT EXISTS public.sop_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text UNIQUE NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sop_categories" ON public.sop_categories FOR SELECT TO authenticated USING (true);

-- 3. Meeting type enum and fields
CREATE TYPE public.meeting_type AS ENUM ('recorrente', 'projeto', 'cliente');

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_type public.meeting_type NOT NULL DEFAULT 'recorrente',
  ADD COLUMN IF NOT EXISTS parent_meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

CREATE INDEX IF NOT EXISTS idx_meetings_parent_meeting_id ON public.meetings(parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_type ON public.meetings(meeting_type);
