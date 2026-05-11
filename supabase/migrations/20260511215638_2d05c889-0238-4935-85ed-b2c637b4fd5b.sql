-- ============================================================
-- Phase 3: Notifications & Email Triggers
-- ============================================================

-- Helper: notify all owners + admins (in-app bell)
CREATE OR REPLACE FUNCTION public.notify_team_users(
  _type text,
  _title text,
  _message text,
  _link text,
  _dedup_key text DEFAULT NULL,
  _extra_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _seen uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR _uid IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('owner', 'admin')
    UNION
    SELECT _extra_user_id WHERE _extra_user_id IS NOT NULL
  LOOP
    IF _uid IS NULL OR _uid = ANY(_seen) THEN CONTINUE; END IF;
    _seen := _seen || _uid;

    -- Dedup window of 1 day for the same user/type/dedup_key
    IF _dedup_key IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = _uid
        AND n.type = _type
        AND n.dedup_key = _dedup_key
        AND n.created_at >= now() - interval '1 day'
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, link, dedup_key)
    VALUES (_uid, _type, _title, _message, _link, _dedup_key);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_team_users(text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_team_users(text, text, text, text, text, uuid) TO service_role, authenticated;

-- Helper: queue a transactional email via pg_net (calls send-transactional-email)
CREATE OR REPLACE FUNCTION public.queue_transactional_email(
  _template_name text,
  _recipient_email text,
  _idempotency_key text,
  _data jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _service_role_key text;
  _request_id bigint;
BEGIN
  IF _recipient_email IS NULL OR _recipient_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO _service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF _service_role_key IS NULL THEN
    RAISE WARNING 'queue_transactional_email: service role key not in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := 'https://rfzzrhldukoeuutxsixw.supabase.co/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', _service_role_key,
      'x-internal-secret', _service_role_key
    ),
    body := jsonb_build_object(
      'templateName', _template_name,
      'recipientEmail', _recipient_email,
      'idempotencyKey', _idempotency_key,
      'templateData', _data
    )
  ) INTO _request_id;

  RETURN _request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.queue_transactional_email(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_transactional_email(text, text, text, jsonb) TO service_role;

-- ============================================================
-- Trigger: client request created from portal
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_client_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client RECORD;
  _settings RECORD;
  _am_user_id uuid;
  _link text;
  _email_data jsonb;
BEGIN
  IF NEW.source <> 'portal' THEN
    RETURN NEW;
  END IF;

  SELECT id, full_name, account_manager_id INTO _client
  FROM public.clients WHERE id = NEW.client_id;

  IF _client.id IS NULL THEN RETURN NEW; END IF;

  _link := '/hub/clientes/' || NEW.client_id::text;

  -- In-app notification for owners/admins + account manager
  PERFORM public.notify_team_users(
    'client_request_created',
    '📩 Novo pedido de cliente',
    coalesce(_client.full_name, 'Cliente') || ' enviou um pedido: ' || NEW.title,
    _link,
    'client-request-' || NEW.id::text,
    _client.account_manager_id
  );

  -- Email to owners + account manager
  SELECT business_name INTO _settings FROM public.business_settings LIMIT 1;

  _email_data := jsonb_build_object(
    'clientName', coalesce(_client.full_name, 'Cliente'),
    'requestTitle', NEW.title,
    'requestMessage', coalesce(NEW.message, ''),
    'businessName', coalesce(_settings.business_name, '')
  );

  -- Send to all owner/admin emails + AM email
  PERFORM public.queue_transactional_email(
    'team-client-request',
    p.email,
    'team-client-request-' || NEW.id::text || '-' || p.user_id::text,
    _email_data
  )
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role IN ('owner', 'admin') AND p.email IS NOT NULL AND p.email <> '';

  IF _client.account_manager_id IS NOT NULL THEN
    PERFORM public.queue_transactional_email(
      'team-client-request',
      p.email,
      'team-client-request-' || NEW.id::text || '-am-' || p.user_id::text,
      _email_data
    )
    FROM public.profiles p
    WHERE p.user_id = _client.account_manager_id
      AND p.email IS NOT NULL AND p.email <> '';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_request_created ON public.client_requests;
CREATE TRIGGER trg_client_request_created
AFTER INSERT ON public.client_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_client_request_created();

-- ============================================================
-- Trigger: meeting prep item added from portal
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_meeting_prep_item_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meeting RECORD;
  _client RECORD;
  _settings RECORD;
  _link text;
  _email_data jsonb;
  _meeting_date_str text;
BEGIN
  IF NEW.source <> 'portal' THEN
    RETURN NEW;
  END IF;

  SELECT id, title, date_time, created_by, client_id INTO _meeting
  FROM public.meetings WHERE id = NEW.meeting_id;

  IF _meeting.id IS NULL THEN RETURN NEW; END IF;

  _link := '/hub/reuniao/' || NEW.meeting_id::text;
  _meeting_date_str := to_char(_meeting.date_time AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI');

  SELECT id, full_name, account_manager_id INTO _client
  FROM public.clients WHERE id = _meeting.client_id;

  -- In-app: meeting creator + owners/admins + AM
  PERFORM public.notify_team_users(
    'meeting_prep_item_added',
    '💡 Novo tópico adicionado pelo cliente',
    coalesce(NEW.author_label, 'Cliente') || ' adicionou um tópico para "' || _meeting.title || '"',
    _link,
    'prep-item-' || NEW.id::text,
    coalesce(_client.account_manager_id, _meeting.created_by)
  );

  -- Extra notify meeting creator if not already covered
  IF _meeting.created_by IS NOT NULL THEN
    PERFORM public.notify_team_users(
      'meeting_prep_item_added',
      '💡 Novo tópico adicionado pelo cliente',
      coalesce(NEW.author_label, 'Cliente') || ' adicionou um tópico para "' || _meeting.title || '"',
      _link,
      'prep-item-' || NEW.id::text || '-creator',
      _meeting.created_by
    );
  END IF;

  SELECT business_name INTO _settings FROM public.business_settings LIMIT 1;

  _email_data := jsonb_build_object(
    'meetingTitle', _meeting.title,
    'meetingDate', _meeting_date_str,
    'topicContent', NEW.content,
    'authorLabel', coalesce(NEW.author_label, 'Cliente'),
    'clientName', coalesce(_client.full_name, ''),
    'businessName', coalesce(_settings.business_name, '')
  );

  -- Email to AM and meeting creator
  IF _client.account_manager_id IS NOT NULL THEN
    PERFORM public.queue_transactional_email(
      'team-meeting-prep-topic',
      p.email,
      'team-prep-' || NEW.id::text || '-am-' || p.user_id::text,
      _email_data
    )
    FROM public.profiles p
    WHERE p.user_id = _client.account_manager_id
      AND p.email IS NOT NULL AND p.email <> '';
  END IF;

  IF _meeting.created_by IS NOT NULL AND _meeting.created_by <> coalesce(_client.account_manager_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    PERFORM public.queue_transactional_email(
      'team-meeting-prep-topic',
      p.email,
      'team-prep-' || NEW.id::text || '-creator-' || p.user_id::text,
      _email_data
    )
    FROM public.profiles p
    WHERE p.user_id = _meeting.created_by
      AND p.email IS NOT NULL AND p.email <> '';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_prep_item_created ON public.meeting_prep_items;
CREATE TRIGGER trg_meeting_prep_item_created
AFTER INSERT ON public.meeting_prep_items
FOR EACH ROW EXECUTE FUNCTION public.handle_meeting_prep_item_created();

-- ============================================================
-- Trigger: new meeting visible in portal -> notify client
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_meeting_scheduled_notify_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client RECORD;
  _settings RECORD;
  _meeting_date_str text;
  _email_data jsonb;
BEGIN
  IF NEW.client_id IS NULL OR NEW.visible_in_portal IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Don't email for meetings already in the past (e.g. backfills)
  IF NEW.date_time <= now() THEN
    RETURN NEW;
  END IF;

  SELECT id, full_name, email INTO _client
  FROM public.clients WHERE id = NEW.client_id;

  IF _client.email IS NULL OR _client.email = '' THEN
    RETURN NEW;
  END IF;

  SELECT business_name INTO _settings FROM public.business_settings LIMIT 1;

  _meeting_date_str := to_char(NEW.date_time AT TIME ZONE 'Europe/Lisbon', 'DD/MM/YYYY "às" HH24:MI');

  _email_data := jsonb_build_object(
    'clientName', coalesce(_client.full_name, 'Cliente'),
    'meetingTitle', NEW.title,
    'meetingDate', _meeting_date_str,
    'meetingUrl', coalesce(NEW.meeting_url, ''),
    'businessName', coalesce(_settings.business_name, '')
  );

  PERFORM public.queue_transactional_email(
    'client-meeting-scheduled',
    _client.email,
    'meeting-scheduled-' || NEW.id::text,
    _email_data
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_scheduled_notify_client ON public.meetings;
CREATE TRIGGER trg_meeting_scheduled_notify_client
AFTER INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.handle_meeting_scheduled_notify_client();