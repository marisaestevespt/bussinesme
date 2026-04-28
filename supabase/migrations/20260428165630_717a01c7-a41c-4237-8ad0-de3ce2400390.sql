UPDATE public.business_settings
SET tactical_areas = '[
  {"key":"comercial","label":"Comercial","enabled":true,"sort_order":1},
  {"key":"marketing","label":"Marketing","enabled":true,"sort_order":2},
  {"key":"financeiro","label":"Contabilidade","enabled":true,"sort_order":3},
  {"key":"operacao","label":"Operação","enabled":true,"sort_order":4},
  {"key":"clientes","label":"Clientes","enabled":true,"sort_order":5},
  {"key":"produtos","label":"Produtos","enabled":true,"sort_order":6},
  {"key":"recursos-humanos","label":"Recursos Humanos","enabled":true,"sort_order":7},
  {"key":"admin","label":"Administração","enabled":false,"sort_order":8}
]'::jsonb;

ALTER TABLE public.business_settings
ALTER COLUMN tactical_areas SET DEFAULT '[
  {"key":"comercial","label":"Comercial","enabled":true,"sort_order":1},
  {"key":"marketing","label":"Marketing","enabled":true,"sort_order":2},
  {"key":"financeiro","label":"Contabilidade","enabled":true,"sort_order":3},
  {"key":"operacao","label":"Operação","enabled":true,"sort_order":4},
  {"key":"clientes","label":"Clientes","enabled":true,"sort_order":5},
  {"key":"produtos","label":"Produtos","enabled":true,"sort_order":6},
  {"key":"recursos-humanos","label":"Recursos Humanos","enabled":true,"sort_order":7},
  {"key":"admin","label":"Administração","enabled":false,"sort_order":8}
]'::jsonb;