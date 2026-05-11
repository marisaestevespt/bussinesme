
-- ============================================================
-- FASE 4: Auditoria + Saúde do Portal
-- ============================================================

-- 1. Helper: insere em audit_logs a partir de contexto do portal (sem auth.uid())
CREATE OR REPLACE FUNCTION public.portal_audit_insert(
  _action text,
  _entity_id text,
  _metadata jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_name, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'Portal Cliente', _action, 'portal', _entity_id, COALESCE(_metadata, '{}'::jsonb));
END;
$$;

-- 2. Trigger: client_requests INSERT → audit
CREATE OR REPLACE FUNCTION public.trg_audit_client_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'portal' THEN
    PERFORM public.portal_audit_insert(
      'portal.request.created',
      NEW.id::text,
      jsonb_build_object('client_id', NEW.client_id, 'title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_client_request_created ON public.client_requests;
CREATE TRIGGER audit_client_request_created
AFTER INSERT ON public.client_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_client_request();

-- 3. Trigger: meeting_prep_items INSERT (source=portal) → audit
CREATE OR REPLACE FUNCTION public.trg_audit_meeting_prep_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'portal' THEN
    PERFORM public.portal_audit_insert(
      'portal.meeting_prep.created',
      NEW.id::text,
      jsonb_build_object('meeting_id', NEW.meeting_id, 'author_label', NEW.author_label)
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_meeting_prep_created ON public.meeting_prep_items;
CREATE TRIGGER audit_meeting_prep_created
AFTER INSERT ON public.meeting_prep_items
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_meeting_prep_item();

-- 4. Trigger: portal_feedback INSERT → audit
CREATE OR REPLACE FUNCTION public.trg_audit_portal_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client_id uuid;
BEGIN
  SELECT client_id INTO _client_id FROM public.portals WHERE id = NEW.portal_id;
  PERFORM public.portal_audit_insert(
    'portal.feedback.submitted',
    NEW.id::text,
    jsonb_build_object('portal_id', NEW.portal_id, 'client_id', _client_id, 'category', NEW.category)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_portal_feedback_created ON public.portal_feedback;
CREATE TRIGGER audit_portal_feedback_created
AFTER INSERT ON public.portal_feedback
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_portal_feedback();

-- 5. RPC: portal_log_login (chamada após sucesso OTP)
CREATE OR REPLACE FUNCTION public.portal_log_login(_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal_id uuid; _client_id uuid;
BEGIN
  SELECT id, client_id INTO _portal_id, _client_id FROM public.portals WHERE token = _token AND is_active = true;
  IF _portal_id IS NULL THEN RETURN; END IF;
  PERFORM public.portal_audit_insert(
    'portal.session.created',
    _portal_id::text,
    jsonb_build_object('client_id', _client_id)
  );
END;
$$;

-- 6. RPC: portal_log_download (chamada do botão)
CREATE OR REPLACE FUNCTION public.portal_log_download(_token uuid, _file_name text, _source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _portal_id uuid; _client_id uuid;
BEGIN
  SELECT id, client_id INTO _portal_id, _client_id FROM public.portals WHERE token = _token AND is_active = true;
  IF _portal_id IS NULL THEN RETURN; END IF;
  PERFORM public.portal_audit_insert(
    'portal.document.downloaded',
    _portal_id::text,
    jsonb_build_object('client_id', _client_id, 'file_name', _file_name, 'source', _source)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_log_login(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_log_download(uuid, text, text) TO anon, authenticated;

-- 7. RPC interno: get_client_portal_audit (apenas owner/admin)
CREATE OR REPLACE FUNCTION public.get_client_portal_audit(_client_id uuid)
RETURNS TABLE(id uuid, action text, metadata jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT al.id, al.action, al.metadata, al.created_at
  FROM public.audit_logs al
  WHERE al.entity_type = 'portal'
    AND (al.metadata->>'client_id')::uuid = _client_id
  ORDER BY al.created_at DESC
  LIMIT 50;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_portal_audit(uuid) TO authenticated;

-- 8. RPC interno: get_client_portal_health
CREATE OR REPLACE FUNCTION public.get_client_portal_health(_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _portal_active boolean;
  _has_am boolean;
  _last_login timestamptz;
  _pending_requests int;
  _pending_feedback int;
  _overdue_recolhas int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'member')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.portals WHERE client_id = _client_id AND is_active = true) INTO _portal_active;
  SELECT (account_manager_id IS NOT NULL) INTO _has_am FROM public.clients WHERE id = _client_id;

  SELECT MAX(al.created_at) INTO _last_login
  FROM public.audit_logs al
  WHERE al.entity_type = 'portal' AND al.action = 'portal.session.created'
    AND (al.metadata->>'client_id')::uuid = _client_id;

  SELECT COUNT(*) INTO _pending_requests
  FROM public.client_requests
  WHERE client_id = _client_id AND status IN ('novo','em_curso');

  SELECT COUNT(*) INTO _pending_feedback
  FROM public.portal_feedback pf
  JOIN public.portals p ON p.id = pf.portal_id
  WHERE p.client_id = _client_id AND pf.team_response IS NULL;

  SELECT COUNT(*) INTO _overdue_recolhas
  FROM public.client_nps_records
  WHERE client_id = _client_id AND status != 'feito' AND expected_date < CURRENT_DATE;

  RETURN jsonb_build_object(
    'portal_active', COALESCE(_portal_active, false),
    'has_account_manager', COALESCE(_has_am, false),
    'last_login_at', _last_login,
    'pending_requests', _pending_requests,
    'pending_feedback', _pending_feedback,
    'overdue_recolhas', _overdue_recolhas
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_portal_health(uuid) TO authenticated;
