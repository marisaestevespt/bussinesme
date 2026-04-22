-- Add custom_role_id to team_members
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_custom_role_id ON public.team_members(custom_role_id);

-- Migrate data from members → team_members
UPDATE public.team_members tm
SET custom_role_id = m.custom_role_id
FROM public.members m
JOIN public.profiles p ON p.user_id = m.user_id
WHERE tm.profile_id = p.id
  AND m.custom_role_id IS NOT NULL;

-- Drop the redundant members table
DROP TABLE IF EXISTS public.members CASCADE;