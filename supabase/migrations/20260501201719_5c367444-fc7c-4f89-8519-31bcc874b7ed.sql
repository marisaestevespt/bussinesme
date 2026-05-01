-- Reforçar integridade: CHECK constraints em enums críticos
-- Valida valores em qualquer rota de inserção (UI, API, scripts)

-- crm_leads.status: valores válidos atualmente em uso + canónicos
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_status_check
  CHECK (status IN ('novo','contactado','reuniao_marcada','proposta_enviada','negociacao','ganho','perdido','outra_altura','arquivado'));

-- financial_expenses.status
ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_status_check
  CHECK (status IN ('por_pagar','pendente','pago_falta_fatura','tudo_ok','cancelado'));

-- financial_expenses.location
ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_location_check
  CHECK (location IS NULL OR location IN ('portugal','ue','fora_ue'));

-- financial_expenses.source_type (NULL permitido para legacy)
ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_source_type_check
  CHECK (source_type IS NULL OR source_type IN ('manual','rule','subscription','contract','contractor','payroll'));