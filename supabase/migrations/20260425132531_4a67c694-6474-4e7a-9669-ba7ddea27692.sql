
-- Fix 1: Make personal-images bucket private with owner-scoped read
UPDATE storage.buckets SET public = false WHERE id = 'personal-images';

DROP POLICY IF EXISTS "Personal images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read personal-images" ON storage.objects;
DROP POLICY IF EXISTS "personal-images public read" ON storage.objects;

CREATE POLICY "personal-images owner or admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'personal-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin_or_owner()
  )
);

-- Fix 2: Notifications — restrict INSERT to self, add RPC for cross-user sends
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RPC: authenticated users can send a notification to another user.
-- Validates inputs and bypasses RLS via SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.send_notification_to_user(
  _user_id uuid,
  _type text,
  _title text,
  _message text DEFAULT NULL,
  _link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _user_id IS NULL OR _type IS NULL OR _title IS NULL THEN
    RAISE EXCEPTION 'missing required fields';
  END IF;
  IF length(_title) > 300 OR length(coalesce(_message,'')) > 2000 OR length(coalesce(_link,'')) > 500 THEN
    RAISE EXCEPTION 'field too long';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, _type, _title, _message, _link)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification_to_user(uuid, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_notification_to_user(uuid, text, text, text, text) TO authenticated;
