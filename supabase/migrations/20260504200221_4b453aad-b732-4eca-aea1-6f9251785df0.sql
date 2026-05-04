-- Normaliza status
UPDATE public.content_items SET status = 'tudo_pronto' WHERE status = 'tudo pronto';

-- Normaliza content_type para os valores canónicos (lowercase, sem acento)
UPDATE public.content_items SET content_type = 'posicionamento' WHERE lower(content_type) = 'posicionamento';
UPDATE public.content_items SET content_type = 'venda' WHERE lower(content_type) = 'venda';
UPDATE public.content_items SET content_type = 'educacao' WHERE content_type IN ('Educação', 'Educacao', 'educação');
UPDATE public.content_items SET content_type = 'identificacao' WHERE content_type IN ('Identificação', 'identificação');
UPDATE public.content_items SET content_type = 'entretenimento' WHERE content_type IN ('Entretenimento');
UPDATE public.content_items SET content_type = 'post' WHERE content_type IN ('Post');
UPDATE public.content_items SET content_type = 'reel' WHERE content_type IN ('Reel', 'Reels', 'reels');

-- Normaliza funnel_stage para os valores canónicos {topo, meio, fundo}
UPDATE public.content_items SET funnel_stage = 'topo' WHERE funnel_stage ILIKE 'topo%';
UPDATE public.content_items SET funnel_stage = 'meio' WHERE funnel_stage ILIKE 'meio%';
UPDATE public.content_items SET funnel_stage = 'fundo' WHERE funnel_stage ILIKE 'fundo%';

-- Normaliza format: 'video' depende do content_type; 'texto' assume post_linkedin
UPDATE public.content_items SET format = 'reels'
  WHERE format = 'video' AND content_type IN ('reel', 'short');
UPDATE public.content_items SET format = 'longo_youtube'
  WHERE format = 'video' AND (content_type IS NULL OR content_type NOT IN ('reel', 'short'));
UPDATE public.content_items SET format = 'post_linkedin' WHERE format = 'texto';
UPDATE public.content_items SET format = 'estatico' WHERE format = 'imagem';
UPDATE public.content_items SET format = 'email' WHERE format = 'newsletter';
UPDATE public.content_items SET format = 'outro' WHERE format = 'audio';