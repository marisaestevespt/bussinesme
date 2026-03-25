Backend cron jobs for auto-status updates, notifications, and data sync.

## Edge Functions
- `daily-status-update` — runs daily at 08:00 via pg_cron
  1. Marks overdue sales as `em_atraso`
  2. Marks current month sales as `aguarda_pagamento`
  3. Changes active clients to `altura_renovacao` based on `renewal_advance_days` from product (default 30)
  4. Creates notification + task for each renewal
  5. Checks expiring team member contracts (30 days ahead)
  6. **Capacity alert** — checks `time_entries` this week per active member vs `expected_weekly_hours`. If ≥90%, notifies owner. Dedup: 1 per member per week.
  7. **Payroll→Financial sync** — finds `financial_payroll` with status=pago and no `expense_id`, creates `financial_expenses` entry and links back. Also syncs `member_payments` with status=pago that have no matching expense (dedup by description+month+year).
  
- `daily-birthday-check` — runs daily at 08:00 via pg_cron
  - Checks clients and team members with birthdays
  - Sends notifications at 30 days, 15 days, and on the day
  - Deduplicates by message key

## Removed from frontend
- `useCommercialData.tsx` — removed useEffect auto-status update of sales
- `App.tsx` — removed `checkBirthdayNotifications()` call
- `AppLayout.tsx` — removed `useContractExpiryNotifications()` and `useClientRenewalNotifications()` hooks
- Files kept but no longer called from frontend: `useBirthdayNotifications.ts`, `useClientRenewalNotifications.ts`, `useContractExpiryNotifications.tsx`
