-- 1. FIX: client_portals RLS — restrict anon UPDATE to only last_visit_at
DROP POLICY IF EXISTS "Portal last_visit updatable by anon" ON public.client_portals;
CREATE POLICY "Portal last_visit updatable by anon"
ON public.client_portals
FOR UPDATE
TO anon
USING (true)
WITH CHECK (
  is_active = (SELECT cp.is_active FROM public.client_portals cp WHERE cp.id = client_portals.id)
  AND client_id = (SELECT cp.client_id FROM public.client_portals cp WHERE cp.id = client_portals.id)
  AND token = (SELECT cp.token FROM public.client_portals cp WHERE cp.id = client_portals.id)
);

-- 2. PERFORMANCE: Add missing indexes on verified tables
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date_time ON public.meetings(date_time);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id ON public.meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_commercial_sales_client ON public.commercial_sales(client);
CREATE INDEX IF NOT EXISTS idx_commercial_sales_status ON public.commercial_sales(status);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_status ON public.financial_expenses(status);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_expense_date ON public.financial_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_expense_month ON public.financial_expenses(expense_month);
CREATE INDEX IF NOT EXISTS idx_time_entries_member_id ON public.time_entries(member_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON public.time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsible_id ON public.crm_leads(responsible_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_profile_id ON public.team_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_sops_department ON public.sops(department);