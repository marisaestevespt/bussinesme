
-- Add linked entity fields to sops table
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS linked_entity_type text NOT NULL DEFAULT 'geral';
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS linked_entity_id uuid;
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS apply_to_all_active_clients boolean NOT NULL DEFAULT false;
