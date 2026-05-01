-- Add UNIQUE constraint on email column so the upsert with onConflict:'email'
-- in send-transactional-email works correctly. Without it, the upsert raises
-- "no unique or exclusion constraint matching the ON CONFLICT specification"
-- and emails fail with "Failed to create unsubscribe token".

-- First, deduplicate any rows that may already share an email (keep oldest).
DELETE FROM public.email_unsubscribe_tokens t
USING public.email_unsubscribe_tokens dup
WHERE t.email = dup.email
  AND t.created_at > dup.created_at;

ALTER TABLE public.email_unsubscribe_tokens
  ADD CONSTRAINT email_unsubscribe_tokens_email_key UNIQUE (email);
