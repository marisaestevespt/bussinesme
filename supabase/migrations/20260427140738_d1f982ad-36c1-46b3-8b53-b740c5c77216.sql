ALTER TABLE public.products ADD COLUMN IF NOT EXISTS calendar_color text;

-- Backfill from existing branding.primary_color when present (hex format)
UPDATE public.products
SET calendar_color = branding->>'primary_color'
WHERE calendar_color IS NULL
  AND branding->>'primary_color' IS NOT NULL
  AND branding->>'primary_color' ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$';