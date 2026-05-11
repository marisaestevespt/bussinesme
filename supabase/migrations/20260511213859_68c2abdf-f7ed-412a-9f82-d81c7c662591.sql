-- Account Manager column on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS account_manager_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_account_manager_id ON public.clients(account_manager_id);

-- Portal RPC: returns account manager public info for a portal token
CREATE OR REPLACE FUNCTION public.get_portal_account_manager(_token uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  role_title text,
  email text,
  whatsapp text,
  photo_url text,
  presentation text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT tm.id, tm.full_name, tm.role_title, tm.email, tm.whatsapp, tm.photo_url, tm.presentation
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.team_members tm ON tm.id = c.account_manager_id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND tm.status = 'ativo'
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.get_portal_account_manager(uuid) TO anon, authenticated;