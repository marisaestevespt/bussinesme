CREATE TABLE public.business_setup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_legal_name TEXT NOT NULL DEFAULT '',
  nif TEXT NOT NULL DEFAULT '',
  cae_principal TEXT NOT NULL DEFAULT '',
  cae_secundarios TEXT NOT NULL DEFAULT '',
  regime_iva TEXT NOT NULL DEFAULT '',
  regime_fiscal TEXT NOT NULL DEFAULT '',
  morada_fiscal TEXT NOT NULL DEFAULT '',
  capital_social TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  banco TEXT NOT NULL DEFAULT '',
  contabilista TEXT NOT NULL DEFAULT '',
  contabilista_contacto TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_setup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage business setup"
  ON public.business_setup FOR ALL TO authenticated USING (true) WITH CHECK (true);