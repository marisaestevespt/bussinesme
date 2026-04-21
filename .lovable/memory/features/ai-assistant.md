---
name: Lyrata AI Assistant - Full CRUD + Email + Period Summary
description: AI assistant with full database read/write, confirmation flow for all write actions, email sending, period summary
type: feature
---
- Edge function: supabase/functions/ai-assistant/index.ts
- Frontend: src/components/FloatingAiChat.tsx
- Model: google/gemini-2.5-flash via Lovable AI Gateway
- Tools: list_tables, query_table (read), period_summary (date range), propose_action + execute_confirmed_action (write)
- All write actions (create, update, delete, send_email) require user confirmation via propose_action
- Blocked tables: member_sensitive_access, backups, user_roles, profiles
- Read-only tables: business_settings, business_setup, automation_settings, system_config, audit_logs
- audit_logs is READ-ONLY (not blocked) — used for period summaries
- period_summary tool gathers:
  - audit_logs, tasks, meetings (by date_time AND by updated_at for status changes)
  - sales, expenses, notifications (portal activity)
  - clients, leads, content
  - portal_initial_questions (answered_at in range) — grouped by portal with client names
  - client_portals (last_visit_at in range) — enriched with client names
  - meetings with portal_notes (client change requests)
- Portal activity tracked via notifications table AND direct queries to portal tables
- Download button on long assistant responses (>200 chars) — downloads as .txt
- Confirmation flow: AI proposes → frontend shows confirm/cancel buttons → user decides → AI executes or cancels
- Email sending uses send-transactional-email edge function (if configured)
