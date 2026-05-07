UPDATE public.tasks t
SET status = 'done', updated_at = now()
FROM public.content_items c
WHERE t.content_id = c.id
  AND t.status <> 'done'
  AND c.status IN ('agendado', 'publicado');