ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS tactical_areas jsonb NOT NULL DEFAULT '[
  {"key":"comercial","label":"Comercial","enabled":true,"sort_order":1},
  {"key":"marketing","label":"Marketing","enabled":true,"sort_order":2},
  {"key":"financeiro","label":"Financeiro","enabled":true,"sort_order":3},
  {"key":"operacoes","label":"Operações","enabled":true,"sort_order":4},
  {"key":"clientes","label":"Clientes","enabled":true,"sort_order":5},
  {"key":"equipa","label":"Equipa","enabled":true,"sort_order":6},
  {"key":"marca","label":"Marca","enabled":true,"sort_order":7},
  {"key":"estrategia","label":"Estratégia","enabled":true,"sort_order":8}
]'::jsonb;