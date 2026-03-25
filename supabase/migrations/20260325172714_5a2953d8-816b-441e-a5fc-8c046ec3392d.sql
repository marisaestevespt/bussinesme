
-- Add sop_type and role_title to sops
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS sop_type text NOT NULL DEFAULT 'operacional';
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS role_title text;
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Create product_team_members table
CREATE TABLE IF NOT EXISTS public.product_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, member_id)
);

ALTER TABLE public.product_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product_team_members"
  ON public.product_team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Migrate existing onboarding templates: set sop_type and role_title on linked SOPs
UPDATE public.sops s
SET sop_type = 'onboarding',
    role_title = t.role_title
FROM public.sop_onboarding_templates t
WHERE t.sop_id = s.id
  AND t.sop_id IS NOT NULL;
