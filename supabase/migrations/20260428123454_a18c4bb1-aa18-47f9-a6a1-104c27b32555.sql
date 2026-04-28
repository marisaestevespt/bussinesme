
DO $$ BEGIN
  CREATE TYPE public.brain_dump_status AS ENUM ('em_ideia', 'aplicado', 'desconsiderado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.executive_brain_dump_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.executive_brain_dump_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth view brain_dump_categories" ON public.executive_brain_dump_categories;
DROP POLICY IF EXISTS "Owner insert brain_dump_categories" ON public.executive_brain_dump_categories;
DROP POLICY IF EXISTS "Owner update brain_dump_categories" ON public.executive_brain_dump_categories;
DROP POLICY IF EXISTS "Owner delete brain_dump_categories" ON public.executive_brain_dump_categories;

CREATE POLICY "Auth view brain_dump_categories" ON public.executive_brain_dump_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner insert brain_dump_categories" ON public.executive_brain_dump_categories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner update brain_dump_categories" ON public.executive_brain_dump_categories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner delete brain_dump_categories" ON public.executive_brain_dump_categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

DROP TRIGGER IF EXISTS trg_brain_dump_categories_updated ON public.executive_brain_dump_categories;
CREATE TRIGGER trg_brain_dump_categories_updated BEFORE UPDATE ON public.executive_brain_dump_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.executive_brain_dump
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.executive_brain_dump_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.brain_dump_status NOT NULL DEFAULT 'em_ideia',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_brain_dump_updated ON public.executive_brain_dump;
CREATE TRIGGER trg_brain_dump_updated BEFORE UPDATE ON public.executive_brain_dump FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

UPDATE public.executive_brain_dump SET status = 'aplicado' WHERE completed = true AND status = 'em_ideia';

CREATE INDEX IF NOT EXISTS idx_brain_dump_status ON public.executive_brain_dump(status);
CREATE INDEX IF NOT EXISTS idx_brain_dump_category ON public.executive_brain_dump(category_id);
