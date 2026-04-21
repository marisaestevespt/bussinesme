ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS kanban_group_order jsonb NOT NULL DEFAULT '[]'::jsonb;