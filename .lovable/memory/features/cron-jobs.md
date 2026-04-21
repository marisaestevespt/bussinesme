Backend cron jobs for auto-status updates, notifications, and data sync.

## Active cron jobs (PG cron + vault auth)
All scheduled jobs use `email_queue_service_role_key` from `vault.decrypted_secrets`.

| Job | Schedule (UTC) |
|---|---|
| `process-email-queue` | every 5s (only if queue non-empty) |
| `weekly-backup` | `0 3 * * 0` (Sun 03:00) |
| `generate-deliverable-tasks` | `0 5 1 * *` (1st of month) |
| `generate-routine-tasks` | `0 6 * * *` |
| `generate-monthly-report` | `0 6 2 * *` (2nd of month) |
| `daily-birthday-check` | `30 7 * * *` |
| `send-payment-reminders-daily` | `0 8 * * *` |
| `daily-status-update` | `0 8 * * *` |
| `check-nps-tasks` | `0 9 * * *` |
| `check-renewal-status` | `15 9 * * *` |
| `send-digest-daily` | `0 18 * * 1-5` |

## Auth helper
All cron-invokable edge functions share `supabase/functions/_shared/cron-auth.ts`
(`isAuthorizedCronCall`) which validates the Bearer JWT issuer + role
(service_role/anon/authenticated). Old `authHeader.includes(serviceKey)` checks
were broken because Lovable Cloud rotates the service key independently of the
vault-stored one used by cron, AND because the JWT base64 payload doesn't
contain the literal "supabase" string.

## Edge Functions
- `daily-status-update` — runs daily at 08:00 via pg_cron
  1. Marks overdue sales as `em_atraso`
  2. Marks current month sales as `aguarda_pagamento`
  3. Changes active clients to `altura_renovacao` based on `renewal_advance_days` from product (default 30)
  4. Creates notification + task for each renewal
  5. Checks expiring team member contracts (30 days ahead)
  6. **Capacity alert** — checks `time_entries` this week per active member vs `expected_weekly_hours`. If ≥90%, notifies owner. Dedup: 1 per member per week.
  7. **Payroll→Financial sync** — finds `financial_payroll` with status=pago and no `expense_id`, creates `financial_expenses` entry and links back. Also syncs `member_payments` with status=pago that have no matching expense (dedup by description+month+year).
  8. **NPS auto-generation** — creates NPS records for clients based on product cadence.
  9. **Meeting reminders** — notifies owner + meeting participants about meetings happening today. Type: `meeting_reminder`. Dedup by `meeting-reminder-{meeting_id}-{date}`.
   10. **Project deadline alerts** — notifies owner about projects with overdue deadlines (not concluido/cancelado). Type: `project_deadline`. Dedup by `project-deadline-{project_id}-{date}`.
   11. **Recurring expenses** — on `recurrence_day` of each month, auto-generates new expenses from templates marked `is_recurring=true`. Sets `parent_expense_id` for traceability. Skips if already generated for current month or past `recurrence_end_date`.
   12. **Overdue task alerts** — daily check for tasks past deadline (not done/cancelada). Notifies owner + assigned user. Type: `task`. Dedup by `task-overdue-{task_id}-{date}`.
   13. **Routine missed alerts** — daily check for routine tasks (`tag=Rotina`) due today that are not completed. Notifies owner + assigned user + routine creator. Shows `role_function` in alert. Dedup by `routine-missed-{task_id}-{date}`.
   14. **CRM follow-up overdue alerts** — daily check for leads with `next_followup < today` (not ganho/perdido). Notifies owner + responsible. Dedup by `followup-overdue-{lead_id}-{date}`.
   
- `daily-birthday-check` — runs daily at 08:00 via pg_cron
  - Checks clients and team members with birthdays
  - Sends notifications at 30 days, 15 days, and on the day
  - Deduplicates by message key

## Meeting Task Creation
- `CreateTasksFromMeetingDialog` component in `src/components/meeting/`
- Button "Criar Tarefas" in Próximos Passos section of ReuniaoDetail
- Opens dialog with unchecked owner/client actions pre-filled
- User can set deadline, department, assignee, priority, project per task

## Project Improvements
- **Cost calculation** — `team_members.hourly_cost` × `time_entries.duration` aggregated per project. Displayed as badge.
- **Auto-progress** — Progress auto-calculated from tasks + boarding items, auto-saved to DB.
- **client_id FK** — Client select dropdown populates both `client_id` and `client_name` on projects.
- **Deadline overdue banner** — Alert banner on project detail when deadline passed + daily cron notification.

## Removed from frontend
- `useCommercialData.tsx` — removed useEffect auto-status update of sales
- `App.tsx` — removed `checkBirthdayNotifications()` call
- `AppLayout.tsx` — removed `useContractExpiryNotifications()` and `useClientRenewalNotifications()` hooks
- Files kept but no longer called from frontend: `useBirthdayNotifications.ts`, `useClientRenewalNotifications.ts`, `useContractExpiryNotifications.tsx`
