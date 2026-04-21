DELETE FROM public.tasks WHERE name IN ('Rotina Teste Semanal','Tarefa Teste Abril') AND assigned_to IS NULL;
DELETE FROM public.planning_routines WHERE title = 'Rotina Teste Semanal';