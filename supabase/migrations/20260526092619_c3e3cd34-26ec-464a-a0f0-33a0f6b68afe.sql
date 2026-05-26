
-- NOT NULL safeguards
ALTER TABLE public.projects ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.team_members ALTER COLUMN profile_id SET NOT NULL;

-- time_entries: faltam task_id e project_id
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD CONSTRAINT time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- tasks.client_id: existe FK mas sem ON DELETE → recriar com SET NULL
ALTER TABLE public.tasks DROP CONSTRAINT tasks_client_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id ON public.tasks(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_project_id ON public.project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_member_id ON public.member_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
