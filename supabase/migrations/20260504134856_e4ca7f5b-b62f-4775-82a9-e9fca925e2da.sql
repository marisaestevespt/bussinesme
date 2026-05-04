-- Substituir a policy permissiva de SELECT em public.meetings
DROP POLICY IF EXISTS "Authenticated can view meetings" ON public.meetings;

CREATE POLICY "Members view only their meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (
  -- Owners e Admins veem tudo
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  -- Criador da reunião
  OR created_by = auth.uid()
  -- Participante (via profile)
  OR EXISTS (
    SELECT 1
    FROM public.meeting_participants mp
    JOIN public.profiles p ON p.id = mp.profile_id
    WHERE mp.meeting_id = meetings.id
      AND p.user_id = auth.uid()
  )
);