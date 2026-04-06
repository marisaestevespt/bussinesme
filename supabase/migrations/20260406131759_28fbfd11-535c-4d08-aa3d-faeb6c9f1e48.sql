CREATE UNIQUE INDEX IF NOT EXISTS idx_one_initial_meeting_per_client
ON public.meetings (client_id)
WHERE meeting_type = 'inicial' AND client_id IS NOT NULL;