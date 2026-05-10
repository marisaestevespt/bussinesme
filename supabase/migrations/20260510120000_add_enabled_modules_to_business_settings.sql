-- Adds enabled_modules jsonb column to business_settings.
-- Stores an array of module keys that are disabled for this instance.
-- Empty array (default) means all modules are visible.
-- Using a "disabled" list keeps backwards compatibility — new modules are visible by default.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS disabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb;
