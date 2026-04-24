-- Migrate any existing 'prestador' status to 'ativo'
-- Vínculo (member_type/contract_type) já indica se é prestador
UPDATE public.team_members SET status = 'ativo' WHERE status = 'prestador';