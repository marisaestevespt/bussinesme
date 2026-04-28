-- Tabela para guardar a cor de cada departamento (estilo Notion)
CREATE TABLE public.department_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_value TEXT NOT NULL UNIQUE,
  color_key TEXT NOT NULL DEFAULT 'gray',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.department_colors ENABLE ROW LEVEL SECURITY;

-- Toda a equipa autenticada vê as cores
CREATE POLICY "Authenticated users can view department colors"
  ON public.department_colors FOR SELECT
  TO authenticated
  USING (true);

-- Apenas owner/admin podem inserir/atualizar
CREATE POLICY "Admins can insert department colors"
  ON public.department_colors FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "Admins can update department colors"
  ON public.department_colors FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_owner());

CREATE POLICY "Admins can delete department colors"
  ON public.department_colors FOR DELETE
  TO authenticated
  USING (public.is_admin_or_owner());

CREATE TRIGGER update_department_colors_updated_at
  BEFORE UPDATE ON public.department_colors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed com cores atuais
INSERT INTO public.department_colors (department_value, color_key) VALUES
  ('admin', 'amber'),
  ('marketing', 'violet'),
  ('comercial', 'amber'),
  ('clientes', 'blue'),
  ('financeiro', 'green'),
  ('operacao', 'violet'),
  ('produtos', 'blue'),
  ('recursos-humanos', 'red');