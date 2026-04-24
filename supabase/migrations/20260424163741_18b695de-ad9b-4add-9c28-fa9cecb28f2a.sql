ALTER TABLE public.member_contracts
ADD COLUMN IF NOT EXISTS previous_contract_id uuid REFERENCES public.member_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_contracts_previous ON public.member_contracts(previous_contract_id);