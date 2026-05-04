-- Add works_with_clients flag to team_members
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS works_with_clients boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.team_members.works_with_clients IS
  'True when the member directly delivers/interacts with clients (account managers, delivery, customer success). Used in CapacityTab and to suggest Customer Success access.';

-- Backfill: members in client-facing departments
UPDATE public.team_members
SET works_with_clients = true
WHERE status = 'ativo'
  AND (
    department IN ('clientes','customer-success','comercial','operacao')
    OR (departments::jsonb ?| array['clientes','customer-success','comercial','operacao'])
  );