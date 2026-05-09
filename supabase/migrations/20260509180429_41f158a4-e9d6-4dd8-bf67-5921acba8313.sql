
ALTER TABLE public.member_contracts
  ADD COLUMN IF NOT EXISTS ss_employer_rate numeric NOT NULL DEFAULT 0.2375,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- Backfill: copiar os valores atuais de team_members para o contrato mais recente
UPDATE public.member_contracts mc
SET
  ss_employer_rate = COALESCE(tm.ss_employer_rate, 0.2375),
  payment_method   = tm.payment_method
FROM public.team_members tm
WHERE mc.member_id = tm.id
  AND mc.id = (
    SELECT id FROM public.member_contracts
    WHERE member_id = tm.id
    ORDER BY created_at DESC
    LIMIT 1
  );
