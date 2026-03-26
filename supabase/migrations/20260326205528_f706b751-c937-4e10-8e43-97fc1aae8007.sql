-- Custom fields system for extensible fields on any entity
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  field_options jsonb DEFAULT NULL,
  sort_order int DEFAULT 0,
  is_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(entity_type, field_name)
);

CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid REFERENCES public.custom_fields(id) ON DELETE CASCADE NOT NULL,
  entity_id uuid NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(field_id, entity_id)
);

-- Client final settlement fields
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS final_settlement_amount numeric DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS final_settlement_notes text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS final_settlement_status text DEFAULT 'pendente';

-- RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage custom_fields" ON public.custom_fields FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage custom_field_values" ON public.custom_field_values FOR ALL TO authenticated USING (true) WITH CHECK (true);