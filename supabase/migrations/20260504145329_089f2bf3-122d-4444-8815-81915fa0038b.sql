
-- 1. Reverter SELECT de meetings para listagem aberta a todos autenticados
DROP POLICY IF EXISTS "Members view only their meetings" ON public.meetings;

CREATE POLICY "Authenticated can view meetings list"
ON public.meetings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2. Função: pode abrir detalhe de reunião?
CREATE OR REPLACE FUNCTION public.user_can_open_meeting(_meeting_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = _meeting_id AND m.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.meeting_participants mp
      JOIN public.profiles p ON p.id = mp.profile_id
      WHERE mp.meeting_id = _meeting_id AND p.user_id = auth.uid()
    );
$$;

-- 3. Função: pode abrir detalhe de cliente?
CREATE OR REPLACE FUNCTION public.user_can_open_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_staff'::app_role)
    OR public.user_in_department('comercial'::text)
    OR public.user_in_department('clientes'::text)
    OR public.user_in_department('operacao'::text)
    OR public.user_can_access_client(_client_id);
$$;

GRANT EXECUTE ON FUNCTION public.user_can_open_meeting(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_open_client(uuid) TO authenticated;
