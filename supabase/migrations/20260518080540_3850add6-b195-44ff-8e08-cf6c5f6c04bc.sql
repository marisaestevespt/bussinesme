-- Unifica roadmap principal + itens recorrentes: itens recorrentes passam a viver
-- dentro de fases (mode='recorrente'), reutilizando product_phases.is_recurring + recurrence_frequency.

-- 1) Permitir 'quinzenal' na CHECK constraint de product_phases.recurrence_frequency
ALTER TABLE public.product_phases
  DROP CONSTRAINT IF EXISTS product_phases_recurrence_frequency_check;
ALTER TABLE public.product_phases
  ADD CONSTRAINT product_phases_recurrence_frequency_check
  CHECK (recurrence_frequency IS NULL OR recurrence_frequency = ANY (ARRAY['semanal'::text,'quinzenal'::text,'mensal'::text,'trimestral'::text]));

-- 2) Adicionar phase_id a product_recurring_items (FK para product_phases)
ALTER TABLE public.product_recurring_items
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.product_phases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_recurring_items_phase_id
  ON public.product_recurring_items(phase_id);

-- 3) Migração de dados: para cada (product_id, frequency) com itens sem fase,
--    encontrar ou criar uma fase recorrente correspondente e ligar os itens.
DO $$
DECLARE
  r RECORD;
  v_phase_id uuid;
  v_name text;
  v_max_order int;
BEGIN
  FOR r IN
    SELECT DISTINCT product_id, frequency
    FROM public.product_recurring_items
    WHERE phase_id IS NULL
  LOOP
    v_name := CASE r.frequency
      WHEN 'semanal' THEN 'Ciclo Semanal'
      WHEN 'quinzenal' THEN 'Ciclo Quinzenal'
      WHEN 'mensal' THEN 'Ciclo Mensal'
      WHEN 'trimestral' THEN 'Ciclo Trimestral'
      ELSE 'Ciclo Recorrente'
    END;

    SELECT id INTO v_phase_id FROM public.product_phases
      WHERE product_id = r.product_id
        AND is_recurring = true
        AND recurrence_frequency = r.frequency
      ORDER BY sort_order LIMIT 1;

    IF v_phase_id IS NULL THEN
      SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_max_order
        FROM public.product_phases WHERE product_id = r.product_id;

      INSERT INTO public.product_phases (product_id, name, sort_order, is_recurring, recurrence_frequency)
        VALUES (r.product_id, v_name, v_max_order, true, r.frequency)
        RETURNING id INTO v_phase_id;
    END IF;

    UPDATE public.product_recurring_items
      SET phase_id = v_phase_id
      WHERE product_id = r.product_id
        AND frequency = r.frequency
        AND phase_id IS NULL;
  END LOOP;
END $$;

-- 4) Trigger: quando fase muda para não-recorrente, desligar itens (mantê-los mas sem fase)
CREATE OR REPLACE FUNCTION public.unlink_recurring_items_on_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_recurring = true AND NEW.is_recurring = false THEN
    UPDATE public.product_recurring_items SET phase_id = NULL WHERE phase_id = NEW.id;
  ELSIF OLD.recurrence_frequency IS DISTINCT FROM NEW.recurrence_frequency AND NEW.is_recurring = true THEN
    -- Sincronizar frequência dos items ligados à fase
    UPDATE public.product_recurring_items SET frequency = NEW.recurrence_frequency WHERE phase_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unlink_recurring_items ON public.product_phases;
CREATE TRIGGER trg_unlink_recurring_items
AFTER UPDATE ON public.product_phases
FOR EACH ROW EXECUTE FUNCTION public.unlink_recurring_items_on_phase_change();

-- 5) Limpar função órfã (já não há trigger a usá-la)
DROP FUNCTION IF EXISTS public.enforce_recurring_no_phase() CASCADE;