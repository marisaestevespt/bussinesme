-- Dedupe brand_kanban_sections: for each (item_id, title), keep the row with non-null content (preferring oldest), delete the rest if empty.
WITH ranked AS (
  SELECT id, item_id, title, content, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY item_id, title
      ORDER BY (content IS NOT NULL AND length(btrim(content)) > 0) DESC, created_at ASC
    ) AS rn
  FROM public.brand_kanban_sections
)
DELETE FROM public.brand_kanban_sections k
USING ranked r
WHERE k.id = r.id AND r.rn > 1;