ALTER TABLE public.business_setup
  ADD COLUMN IF NOT EXISTS email_test_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_test_redirect text NOT NULL DEFAULT 'amarisaeg@gmail.com',
  ADD COLUMN IF NOT EXISTS email_send_to_clients_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.business_setup.email_test_mode IS 'When true, all transactional/digest emails are redirected to email_test_redirect with a [TEST] subject prefix. Safety switch.';
COMMENT ON COLUMN public.business_setup.email_test_redirect IS 'Destination email when email_test_mode=true.';
COMMENT ON COLUMN public.business_setup.email_send_to_clients_enabled IS 'When false, emails to client recipients (clients, leads) are skipped entirely even if test mode is off. Internal/team emails still go through. Master switch for client communications.';