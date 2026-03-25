
-- Add multi-department support
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS departments jsonb DEFAULT '[]'::jsonb;

-- Migrate existing single department data to array
UPDATE public.team_members 
SET departments = jsonb_build_array(department) 
WHERE department IS NOT NULL AND department != '' AND (departments IS NULL OR departments = '[]'::jsonb);
