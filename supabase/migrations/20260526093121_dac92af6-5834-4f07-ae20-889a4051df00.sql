
CREATE INDEX IF NOT EXISTS idx_portal_initial_questions_portal_id ON public.portal_initial_questions(portal_id);
CREATE INDEX IF NOT EXISTS idx_project_recurring_occurrences_project_id ON public.project_recurring_occurrences(project_id);
CREATE INDEX IF NOT EXISTS idx_project_recurring_occurrences_linked_task_id ON public.project_recurring_occurrences(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_project_recurring_occurrences_linked_deliverable_id ON public.project_recurring_occurrences(linked_deliverable_id);
CREATE INDEX IF NOT EXISTS idx_project_recurring_occurrences_linked_meeting_id ON public.project_recurring_occurrences(linked_meeting_id);
CREATE INDEX IF NOT EXISTS idx_sop_steps_sop_id ON public.sop_steps(sop_id);
CREATE INDEX IF NOT EXISTS idx_content_attachments_content_id ON public.content_attachments(content_id);
CREATE INDEX IF NOT EXISTS idx_financial_contractors_expense_id ON public.financial_contractors(expense_id);
CREATE INDEX IF NOT EXISTS idx_department_kpis_objective_id ON public.department_kpis(objective_id);
CREATE INDEX IF NOT EXISTS idx_portal_initial_questions_portal_answered ON public.portal_initial_questions(portal_id, answered_at);
