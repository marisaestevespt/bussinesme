
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_member_active_unique
ON public.suppliers(member_id)
WHERE member_id IS NOT NULL AND is_active = true;
