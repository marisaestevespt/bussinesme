-- Add WhatsApp team group URL to business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_team_url text;

-- Create department WhatsApp links table
CREATE TABLE IF NOT EXISTS public.department_whatsapp_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL UNIQUE,
  whatsapp_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.department_whatsapp_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read department whatsapp links"
  ON public.department_whatsapp_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners and admins can manage department whatsapp links"
  ON public.department_whatsapp_links FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.team_members tm ON tm.profile_id = p.id
      WHERE p.user_id = auth.uid() AND tm.department = 'admin'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner') OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.team_members tm ON tm.profile_id = p.id
      WHERE p.user_id = auth.uid() AND tm.department = 'admin'
    )
  );

-- Add WhatsApp group URL to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS whatsapp_group_url text;