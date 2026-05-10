-- Dimensões livres por produto (ex: "Equipa cliente", "Complexidade", "Urgência")
CREATE TABLE public.product_modifier_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_modifier_dimensions_product ON public.product_modifier_dimensions(product_id);

-- Níveis dentro de cada dimensão
CREATE TABLE public.product_modifier_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id uuid NOT NULL REFERENCES public.product_modifier_dimensions(id) ON DELETE CASCADE,
  label text NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_modifier_levels_dimension ON public.product_modifier_levels(dimension_id);

ALTER TABLE public.product_modifier_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifier_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage modifier dimensions"
  ON public.product_modifier_dimensions FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "block_suspended_users_modifier_dimensions"
  ON public.product_modifier_dimensions FOR ALL
  USING (NOT current_user_is_suspended()) WITH CHECK (NOT current_user_is_suspended());

CREATE POLICY "Authenticated users can manage modifier levels"
  ON public.product_modifier_levels FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "block_suspended_users_modifier_levels"
  ON public.product_modifier_levels FOR ALL
  USING (NOT current_user_is_suspended()) WITH CHECK (NOT current_user_is_suspended());

-- Triggers updated_at
CREATE TRIGGER trg_product_modifier_dimensions_updated
  BEFORE UPDATE ON public.product_modifier_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_product_modifier_levels_updated
  BEFORE UPDATE ON public.product_modifier_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar complexity_levels (JSON) para nova estrutura
DO $$
DECLARE
  prod RECORD;
  dim_id uuid;
  lvl jsonb;
  i integer;
BEGIN
  FOR prod IN
    SELECT id, complexity_levels
    FROM public.products
    WHERE complexity_levels IS NOT NULL
      AND jsonb_typeof(complexity_levels) = 'array'
      AND jsonb_array_length(complexity_levels) > 0
  LOOP
    INSERT INTO public.product_modifier_dimensions (product_id, name, sort_order)
    VALUES (prod.id, 'Complexidade', 0)
    RETURNING id INTO dim_id;

    i := 0;
    FOR lvl IN SELECT * FROM jsonb_array_elements(prod.complexity_levels)
    LOOP
      INSERT INTO public.product_modifier_levels (dimension_id, label, multiplier, sort_order)
      VALUES (
        dim_id,
        COALESCE(lvl->>'label', 'Nível'),
        COALESCE((lvl->>'multiplier')::numeric, 1),
        i
      );
      i := i + 1;
    END LOOP;
  END LOOP;
END $$;