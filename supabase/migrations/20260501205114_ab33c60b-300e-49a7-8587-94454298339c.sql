-- =========================================================
-- G6: Corrigir CHECK de status (estava desalinhado com app)
-- =========================================================
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_status_check;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_status_check
    CHECK (status IN (
      'lead','primeiro_contacto','sessao_agendada','proposta_enviada',
      'follow_up_1','follow_up_2','follow_up_3','aguarda_retorno',
      'outra_altura','ganho','perdido'
    ));

-- =========================================================
-- G2 (parcial): adicionar ON DELETE SET NULL ao responsible_id
-- (a FK existia mas sem politica de delete -> RESTRICT por defeito)
-- =========================================================
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_responsible_id_fkey;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_responsible_id_fkey
    FOREIGN KEY (responsible_id) REFERENCES public.profiles(id) ON DELETE SET NULL;