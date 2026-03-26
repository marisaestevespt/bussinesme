
-- Composite indices for most-queried columns
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_status ON public.tasks (deadline, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tag_deadline ON public.tasks (tag, deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_status ON public.tasks (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_month_year ON public.financial_expenses (expense_month, expense_year);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_date ON public.financial_expenses (expense_date);
CREATE INDEX IF NOT EXISTS idx_commercial_sales_month_year ON public.commercial_sales (sale_month, sale_year);
CREATE INDEX IF NOT EXISTS idx_commercial_sales_payment_date ON public.commercial_sales (payment_date);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads (status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_next_followup ON public.crm_leads (next_followup);
CREATE INDEX IF NOT EXISTS idx_content_items_scheduled ON public.content_items (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_date_time ON public.meetings (date_time);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_member_date ON public.time_entries (member_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_client_nps_expected_date ON public.client_nps_records (expected_date, status);
CREATE INDEX IF NOT EXISTS idx_financial_payroll_month_year ON public.financial_payroll (month, year);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON public.notifications (user_id, type);
