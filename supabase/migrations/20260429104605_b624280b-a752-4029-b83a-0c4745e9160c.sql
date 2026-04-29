
-- 1. Add dedup_key column for technical deduplication keys
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedup_key TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (user_id, type, dedup_key);

-- 2. Migrate existing rows: messages that look like dedup keys
--    (slug-with-dashes, no spaces, no accented letters) move to dedup_key
--    and message is cleared.
UPDATE public.notifications
SET dedup_key = message,
    message = NULL
WHERE message IS NOT NULL
  AND message ~ '^[a-z0-9]+(-[a-z0-9]+)+$'
  AND message !~ ' ';

-- 3. Fix Joana Magalhães Leça: her product is one-off, revert status
UPDATE public.clients
SET status = 'ativo', updated_at = now()
WHERE id = '6ad681cc-801f-4791-8cdc-b05f7cab7189'
  AND status = 'altura_renovacao';

-- 4. Remove wrongly-created renewal notifications for Joana (one-off product)
DELETE FROM public.notifications
WHERE type = 'client_renewal'
  AND (link LIKE '%6ad681cc-801f-4791-8cdc-b05f7cab7189%'
       OR title LIKE '%Joana Magalhães Leça%');

-- 5. Remove wrongly-created renewal task for Joana
DELETE FROM public.tasks
WHERE name = 'Renovação — Joana Magalhães Leça'
  AND status = 'por_comecar';
