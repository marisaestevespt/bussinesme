
-- L4 — Apertar RLS de events/event_members/event_attachments + constraints

-- Helper: pode editar um evento?
CREATE OR REPLACE FUNCTION public.can_edit_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      JOIN public.profiles p ON p.id = em.profile_id
      WHERE em.event_id = _event_id AND p.user_id = auth.uid()
    );
$$;

-- ─── events ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can update events" ON public.events;

CREATE POLICY "events_update_role_based"
  ON public.events FOR UPDATE TO authenticated
  USING (can_edit_event(id))
  WITH CHECK (can_edit_event(id));

-- ─── event_members ───────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can insert event members" ON public.event_members;

CREATE POLICY "event_members_insert_editors"
  ON public.event_members FOR INSERT TO authenticated
  WITH CHECK (can_edit_event(event_id));

CREATE POLICY "event_members_delete_editors"
  ON public.event_members FOR DELETE TO authenticated
  USING (can_edit_event(event_id));

-- ─── event_attachments ───────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can insert event attachments" ON public.event_attachments;

CREATE POLICY "event_attachments_insert_editors"
  ON public.event_attachments FOR INSERT TO authenticated
  WITH CHECK (can_edit_event(event_id));

CREATE POLICY "event_attachments_delete_editors"
  ON public.event_attachments FOR DELETE TO authenticated
  USING (can_edit_event(event_id));

-- ─── CHECK recurrence_type ───────────────────────────────
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_recurrence_type_check;
ALTER TABLE public.events ADD CONSTRAINT events_recurrence_type_check
  CHECK (recurrence_type IS NULL OR recurrence_type IN (
    'diario','semanal','quinzenal','mensal','mensal_primeiro'
  ));

-- ─── Trigger: end_date >= start_date ─────────────────────
CREATE OR REPLACE FUNCTION public.validate_event_dates()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'A data de fim do evento (%) não pode ser anterior à data de início (%)',
      NEW.end_date, NEW.start_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_validate_dates ON public.events;
CREATE TRIGGER events_validate_dates
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_event_dates();
