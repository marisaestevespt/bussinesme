CREATE OR REPLACE FUNCTION public.ensure_meeting_creator_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.created_by) THEN
    INSERT INTO public.meeting_participants (meeting_id, profile_id)
    VALUES (NEW.id, NEW.created_by)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_meeting_creator_participant ON public.meetings;
CREATE TRIGGER trg_ensure_meeting_creator_participant
AFTER INSERT ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.ensure_meeting_creator_participant();

CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participants_meeting_profile
  ON public.meeting_participants(meeting_id, profile_id);

INSERT INTO public.meeting_participants (meeting_id, profile_id)
SELECT m.id, m.created_by
FROM public.meetings m
JOIN public.profiles p ON p.id = m.created_by
WHERE NOT EXISTS (
    SELECT 1 FROM public.meeting_participants mp
    WHERE mp.meeting_id = m.id AND mp.profile_id = m.created_by
  )
ON CONFLICT DO NOTHING;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.meetings WHERE status::text IN ('realizada','terminada','confirmada') LOOP
    PERFORM public.upsert_meeting_time_entries(r.id);
  END LOOP;
END $$;