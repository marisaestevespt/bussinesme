-- 1. Tabela de capas por departamento
CREATE TABLE IF NOT EXISTS public.department_covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_key TEXT NOT NULL UNIQUE,
  image_url TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.department_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dept covers"
  ON public.department_covers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners/admins can insert dept covers"
  ON public.department_covers FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners/admins can update dept covers"
  ON public.department_covers FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners/admins can delete dept covers"
  ON public.department_covers FOR DELETE
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_department_covers_updated_at ON public.department_covers;
CREATE TRIGGER update_department_covers_updated_at
  BEFORE UPDATE ON public.department_covers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Bucket público para capas
INSERT INTO storage.buckets (id, name, public)
VALUES ('process-covers', 'process-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket
CREATE POLICY "Public can read process covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'process-covers');

CREATE POLICY "Authenticated can upload process covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'process-covers' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update process covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'process-covers' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete process covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'process-covers' AND auth.uid() IS NOT NULL);