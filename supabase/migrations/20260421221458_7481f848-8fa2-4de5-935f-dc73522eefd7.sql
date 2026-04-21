-- Link Marisa's existing profile to her team_member record
UPDATE public.team_members
SET profile_id = 'd7d4e732-afbc-47df-9d39-d676c8ddebc8'
WHERE id = 'b6e8680b-7189-4ef7-8400-105e18823422';

-- Ensure she has the 'member' role (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT 'a7e83e80-7179-47b0-a928-2d012e96a281', 'member'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = 'a7e83e80-7179-47b0-a928-2d012e96a281' AND role = 'member'
);

-- Align Bianca's project task_mode with the product's correct task_mode (tarefas_fixas)
-- The product "Assistente Virtual" doesn't use phases — only onboarding + recurring monthly tasks
UPDATE public.projects
SET task_mode = 'tarefas_fixas'
WHERE id = '605ff99a-4372-4514-90c6-54668cadb62b';