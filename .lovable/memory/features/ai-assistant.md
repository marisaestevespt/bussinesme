---
name: Lirah AI Assistant - Full CRUD + Email
description: AI assistant with full database read/write, confirmation flow for all write actions, email sending
type: feature
---
- Edge function: supabase/functions/ai-assistant/index.ts
- Frontend: src/components/FloatingAiChat.tsx
- Model: google/gemini-2.5-flash via Lovable AI Gateway
- Tools: list_tables, query_table (read), propose_action + execute_confirmed_action (write)
- All write actions (create, update, delete, send_email) require user confirmation via propose_action
- Blocked tables: audit_logs, member_sensitive_access, backups, user_roles, profiles
- Read-only tables: business_settings, business_setup, automation_settings, system_config
- Confirmation flow: AI proposes → frontend shows confirm/cancel buttons → user decides → AI executes or cancels
- Email sending uses send-transactional-email edge function (if configured)
