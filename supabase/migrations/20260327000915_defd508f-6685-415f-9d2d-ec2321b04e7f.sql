CREATE TABLE public.automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read automation_settings"
  ON public.automation_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can update automation_settings"
  ON public.automation_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Seed all automations as enabled by default
INSERT INTO public.automation_settings (automation_key, label, description) VALUES
  ('sales_overdue', 'Vendas em atraso', 'Marca vendas como "em atraso" quando a data de pagamento passou'),
  ('sales_awaiting', 'Vendas a aguardar pagamento', 'Marca vendas do mês corrente como "aguarda pagamento"'),
  ('client_renewal', 'Renovação de clientes', 'Alerta quando um cliente está perto do fim de ciclo'),
  ('contract_expiry', 'Expiração de contratos', 'Alerta quando contratos de equipa estão a expirar (30 dias)'),
  ('capacity_alert', 'Alerta de capacidade', 'Notifica quando um membro atinge ≥90% de capacidade semanal'),
  ('payroll_sync', 'Sincronização payroll → despesas', 'Cria despesas financeiras automaticamente a partir de pagamentos processados'),
  ('payroll_autogen', 'Geração automática de payroll', 'Gera registos de payroll mensais para contratos de trabalho activos'),
  ('portal_deactivation', 'Desactivação de portais', 'Desactiva portais de clientes terminados após a data configurada'),
  ('nps_autogen', 'Geração automática de NPS', 'Cria registos NPS para clientes activos com cadência configurada no produto'),
  ('meeting_reminders', 'Lembretes de reuniões', 'Notifica sobre reuniões do dia'),
  ('project_deadlines', 'Alertas de deadline de projetos', 'Notifica sobre projetos com deadline em atraso'),
  ('overdue_tasks', 'Alertas de tarefas em atraso', 'Notifica sobre tarefas com deadline ultrapassado'),
  ('crm_followup', 'Follow-up CRM em atraso', 'Notifica sobre leads com follow-up em atraso'),
  ('routine_missed', 'Rotinas não concluídas', 'Notifica sobre rotinas do dia não concluídas'),
  ('recurring_expenses', 'Despesas recorrentes', 'Gera despesas recorrentes automaticamente no dia configurado'),
  ('fiscal_tasks', 'Tarefas fiscais', 'Cria tarefas automáticas para obrigações fiscais'),
  ('access_revoke', 'Revogar acessos inativos', 'Revoga acessos de membros inativos após 7 dias');

CREATE TRIGGER update_automation_settings_updated_at
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();