Backend cron jobs for auto-status updates and birthday notifications.

## Edge Functions
- `daily-status-update` — runs daily at 08:00 via pg_cron
  - Marks overdue sales as `em_atraso`
  - Marks current month sales as `aguarda_pagamento`
  - Changes active clients to `altura_renovacao` based on `renewal_advance_days` from product (default 30)
  - Creates notification + task for each renewal
  - Checks expiring team member contracts (30 days ahead)
  
- `daily-birthday-check` — runs daily at 08:00 via pg_cron
  - Checks clients and team members with birthdays
  - Sends notifications at 30 days, 15 days, and on the day
  - Deduplicates by message key

## Removed from frontend
- `useCommercialData.tsx` — removed useEffect auto-status update of sales
- `App.tsx` — removed `checkBirthdayNotifications()` call
- `AppLayout.tsx` — removed `useContractExpiryNotifications()` and `useClientRenewalNotifications()` hooks
- Files kept but no longer called from frontend: `useBirthdayNotifications.ts`, `useClientRenewalNotifications.ts`, `useContractExpiryNotifications.tsx`
