
CREATE TABLE public.sop_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  deadline_days integer,
  deadline_unit text DEFAULT 'dias',
  deadline_trigger text DEFAULT 'apos_inicio',
  responsible text,
  portal_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sop_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sop_steps"
  ON public.sop_steps
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_sop_steps_updated_at
  BEFORE UPDATE ON public.sop_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add step_id to sop_step_documents referencing the new table
ALTER TABLE public.sop_step_documents
  ADD COLUMN step_id uuid REFERENCES public.sop_steps(id) ON DELETE CASCADE;

-- Migrate existing passos arrays into sop_steps
INSERT INTO public.sop_steps (sop_id, description, sort_order)
SELECT s.id, elem.value::text, (elem.ordinality - 1)::integer
FROM public.sops s,
     jsonb_array_elements_text(s.passos) WITH ORDINALITY AS elem(value, ordinality)
WHERE s.passos IS NOT NULL AND jsonb_array_length(s.passos) > 0;
