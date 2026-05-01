---
name: Welcome client email
description: Manual welcome email to clients with portal access, project info, next steps, WhatsApp button. Triggered from ClientPortalSection.
type: feature
---
Manual button in `ClientPortalSection.tsx` calls edge function `send-client-welcome` → invokes `send-transactional-email` with template `welcome-client`. Stores `welcome_email_sent_at` in `client_portals`. Settings (intro_text, next_steps, support_hours, whatsapp_number/message) live in `business_settings.welcome_client_email_settings` JSONB, edited in Definições → Emails via `WelcomeClientEmailSettings.tsx`. End date computed from `project.start_date + product.cycle_duration`. Only works for clients with portal (projeto_unico / servico_mensal).