-- Add icon (jsonb) + cover_url (text) to main entities, Notion-style
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS icon jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS icon jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text;

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS icon jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text;

ALTER TABLE public.sops
  ADD COLUMN IF NOT EXISTS icon jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS icon jsonb,
  ADD COLUMN IF NOT EXISTS cover_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS icon jsonb;

-- Backfill from existing image fields
UPDATE public.team_members
SET icon = jsonb_build_object('type','image','value', photo_url)
WHERE icon IS NULL AND photo_url IS NOT NULL AND photo_url <> '';

UPDATE public.profiles
SET icon = jsonb_build_object('type','image','value', avatar_url)
WHERE icon IS NULL AND avatar_url IS NOT NULL AND avatar_url <> '';

COMMENT ON COLUMN public.clients.icon       IS 'Notion-style icon: { type: "emoji" | "image", value: string }';
COMMENT ON COLUMN public.projects.icon      IS 'Notion-style icon: { type: "emoji" | "image", value: string }';
COMMENT ON COLUMN public.meetings.icon      IS 'Notion-style icon: { type: "emoji" | "image", value: string }';
COMMENT ON COLUMN public.sops.icon          IS 'Notion-style icon: { type: "emoji" | "image", value: string }';
COMMENT ON COLUMN public.team_members.icon  IS 'Notion-style icon: { type: "emoji" | "image", value: string }';
COMMENT ON COLUMN public.profiles.icon      IS 'Notion-style icon: { type: "emoji" | "image", value: string }';