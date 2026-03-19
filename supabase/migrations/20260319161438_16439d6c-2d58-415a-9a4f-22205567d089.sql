
-- Add expected_weekly_hours to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS expected_weekly_hours numeric NOT NULL DEFAULT 40;

-- Time entries table
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id text NOT NULL DEFAULT 'T2026-01',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  duration numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'outro',
  task_id uuid,
  project_id uuid,
  client_id uuid,
  description text,
  entry_month integer,
  entry_week integer,
  entry_quarter integer,
  entry_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-generate entry_id
CREATE OR REPLACE FUNCTION public.generate_time_entry_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_year integer;
  next_num integer;
BEGIN
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.entry_date, CURRENT_DATE));
  SELECT COALESCE(MAX(
    CASE WHEN entry_id ~ ('^T' || current_year || '-[0-9]+$')
    THEN CAST(SUBSTRING(entry_id FROM LENGTH('T' || current_year || '-') + 1) AS integer)
    ELSE 0 END
  ), 0) + 1 INTO next_num FROM public.time_entries;
  IF NEW.entry_id = 'T2026-01' OR NEW.entry_id IS NULL THEN
    NEW.entry_id := 'T' || current_year || '-' || LPAD(next_num::text, 2, '0');
  END IF;
  -- Auto-fill date-derived fields
  NEW.entry_month := EXTRACT(MONTH FROM NEW.entry_date);
  NEW.entry_week := EXTRACT(WEEK FROM NEW.entry_date);
  NEW.entry_quarter := CEIL(EXTRACT(MONTH FROM NEW.entry_date) / 3.0);
  NEW.entry_year := EXTRACT(YEAR FROM NEW.entry_date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_time_entry_id_trigger
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_time_entry_id();
