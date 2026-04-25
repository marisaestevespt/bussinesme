-- Add icon field to products (Notion-style: emoji or image)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS icon jsonb;

-- Backfill from existing logo_url
UPDATE public.products
SET icon = jsonb_build_object('type', 'image', 'value', logo_url)
WHERE icon IS NULL AND logo_url IS NOT NULL AND logo_url <> '';

COMMENT ON COLUMN public.products.icon IS 'Notion-style icon: { type: "emoji" | "image", value: string }';