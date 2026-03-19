
-- Clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL DEFAULT 'C2026-01',
  status text NOT NULL DEFAULT 'ativo',
  start_date date NULL,
  end_of_cycle date NULL,
  current_product text NULL,
  dp text NULL,
  payment_method text NULL,
  full_name text NOT NULL,
  nif text NULL,
  fiscal_address text NULL,
  birthday date NULL,
  observations text NULL,
  email text NULL,
  whatsapp text NULL,
  documents text NULL,
  drive_folder_url text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete clients" ON public.clients FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Auto-generate client_id
CREATE OR REPLACE FUNCTION public.generate_client_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  current_year integer;
  next_num integer;
BEGIN
  current_year := EXTRACT(YEAR FROM now());
  SELECT COALESCE(MAX(
    CASE WHEN client_id ~ ('^C' || current_year || '-[0-9]+$')
    THEN CAST(SUBSTRING(client_id FROM LENGTH('C' || current_year || '-') + 1) AS integer)
    ELSE 0 END
  ), 0) + 1 INTO next_num FROM public.clients;
  
  IF NEW.client_id = 'C2026-01' OR NEW.client_id IS NULL THEN
    NEW.client_id := 'C' || current_year || '-' || LPAD(next_num::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_client_id
  BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.generate_client_id();

CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Client history table
CREATE TABLE public.client_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  milestone text NOT NULL DEFAULT '',
  observations text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view client_history" ON public.client_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert client_history" ON public.client_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update client_history" ON public.client_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete client_history" ON public.client_history FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Client activities map
CREATE TABLE public.client_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phase text NULL,
  activity text NOT NULL DEFAULT '',
  responsible text NULL,
  rule text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view client_activities" ON public.client_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert client_activities" ON public.client_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update client_activities" ON public.client_activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete client_activities" ON public.client_activities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Client onboarding checklist
CREATE TABLE public.client_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phase text NULL,
  activity text NOT NULL DEFAULT '',
  responsible text NULL,
  rule text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view client_onboarding" ON public.client_onboarding FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert client_onboarding" ON public.client_onboarding FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update client_onboarding" ON public.client_onboarding FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete client_onboarding" ON public.client_onboarding FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
