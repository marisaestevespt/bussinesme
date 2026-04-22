-- Garantir que o trigger entrega->tarefa continua a usar 'done' (já usa) e
-- simplificar o trigger tarefa->entrega para tratar 'done' como o único valor canónico de conclusão.
CREATE OR REPLACE FUNCTION public.sync_task_status_to_deliverable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'done' THEN
    UPDATE public.project_deliverables
    SET status = 'concluido', updated_at = now()
    WHERE id = NEW.deliverable_id AND status NOT IN ('concluido','entregue');
  ELSIF NEW.status = 'aguarda_feedback' THEN
    UPDATE public.project_deliverables
    SET status = 'aguarda_cliente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status NOT IN ('concluido','entregue');
  ELSIF OLD.status IN ('done','aguarda_feedback') THEN
    UPDATE public.project_deliverables
    SET status = 'pendente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status NOT IN ('concluido','entregue');
  END IF;

  RETURN NEW;
END;
$function$;