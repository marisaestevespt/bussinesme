-- Cleanup orphan notifications + add FK with cascade
DELETE FROM public.notifications n
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = n.user_id);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;