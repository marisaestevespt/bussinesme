
ALTER TABLE public.marketing_ideas ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.marketing_idea_views ADD COLUMN IF NOT EXISTS filter_tags text[];

UPDATE public.marketing_ideas
SET tags = ARRAY[category]
WHERE category IS NOT NULL AND category <> 'todas' AND (tags IS NULL OR array_length(tags,1) IS NULL);

UPDATE public.marketing_idea_views
SET filter_tags = ARRAY[category]
WHERE category IS NOT NULL AND filter_tags IS NULL;

ALTER TABLE public.marketing_ideas DROP COLUMN IF EXISTS category;
ALTER TABLE public.marketing_idea_views DROP COLUMN IF EXISTS category;

CREATE INDEX IF NOT EXISTS idx_marketing_ideas_tags ON public.marketing_ideas USING GIN (tags);
