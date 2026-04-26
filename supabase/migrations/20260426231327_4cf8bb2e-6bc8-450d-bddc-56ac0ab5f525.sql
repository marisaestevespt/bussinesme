CREATE TABLE public.team_role_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.team_role_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view role presets"
  ON public.team_role_presets FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage role presets - insert"
  ON public.team_role_presets FOR INSERT
  TO authenticated WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Admins manage role presets - update"
  ON public.team_role_presets FOR UPDATE
  TO authenticated USING (public.is_admin_or_owner());

CREATE POLICY "Admins manage role presets - delete"
  ON public.team_role_presets FOR DELETE
  TO authenticated USING (public.is_admin_or_owner());