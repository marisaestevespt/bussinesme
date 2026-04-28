CREATE TABLE public.strategic_directives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  horizon text NOT NULL DEFAULT '3_anos' CHECK (horizon IN ('3_anos','5_anos')),
  area text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','em_revisao','concluida','arquivada')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.strategic_directives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/owners can view directives"
  ON public.strategic_directives FOR SELECT
  TO authenticated
  USING (public.is_admin_or_owner());

CREATE POLICY "Admins/owners can insert directives"
  ON public.strategic_directives FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Admins/owners can update directives"
  ON public.strategic_directives FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_owner())
  WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Admins/owners can delete directives"
  ON public.strategic_directives FOR DELETE
  TO authenticated
  USING (public.is_admin_or_owner());

CREATE TRIGGER set_strategic_directives_updated_at
  BEFORE UPDATE ON public.strategic_directives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_strategic_directives_sort ON public.strategic_directives(sort_order, created_at DESC);