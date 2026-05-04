-- Normaliza status com espaço para o valor canónico
UPDATE public.content_items SET status = 'tudo_pronto' WHERE status = 'tudo pronto';
