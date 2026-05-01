
-- Add JSON settings column to business_settings for client welcome email
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS welcome_client_email_settings jsonb NOT NULL DEFAULT '{
  "intro_text": "Estamos muito felizes por te ter connosco! A partir de agora vamos trabalhar juntos para alcançar os teus objetivos. Aqui ficam as primeiras informações que precisas para começar.",
  "next_steps": [
    "Aceder ao Portal do Cliente e explorar o teu espaço",
    "Responder ao briefing inicial",
    "Confirmar a data da reunião de kickoff"
  ],
  "support_hours": "Segunda a Sexta, 9h-18h",
  "whatsapp_number": "+351913544824",
  "whatsapp_message": "Olá! Sou cliente e gostaria de tirar uma dúvida."
}'::jsonb;

-- Track when welcome email was sent for each portal
ALTER TABLE public.client_portals
ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamp with time zone;
