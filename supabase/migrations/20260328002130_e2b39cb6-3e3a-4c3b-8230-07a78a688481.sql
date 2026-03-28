
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS accountant_type text NOT NULL DEFAULT 'externo',
  ADD COLUMN IF NOT EXISTS accountant_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;
