---
name: security-audit
description: RLS hardening history + current state. Single-tenant arch (1 instance per business). Latest: PII protection via views + bucket lockdown 2026-04-22.
type: feature
---
Security audit: RLS hardening, cron auth guards, query safety, DB indexes, password edge function hardening, PII protection.

## Architecture
- Single-tenant: each business = separate Supabase project. No business_id needed.
- Isolation is at infrastructure level. Authenticated team can SELECT operational tables.
- Sensitive data on PII tables (clients, team_members, business_setup, suppliers, client_contacts) remains accessible to authenticated team — single-tenant trust model. For multi-role teams needing field-level redaction, app must consume `*_public` views (created 2026-04-22).

## Latest hardening (2026-04-22) — Final pre-delivery audit

### Storage buckets (private, role-gated)
- `financial-files`: SELECT/INSERT/UPDATE/DELETE → Owner OR `current_user_has_sensitive_access('financial_values')`. Old permissive policies dropped (PERMISSIVE OR-bypass risk).
- `library-files`: SELECT/INSERT/UPDATE/DELETE → Owner OR sensitive `financial_values`/`contracts`. Old permissive policies dropped.
- `portal-uploads`: anon INSERT removed; authenticated INSERT/SELECT only.

### Tables locked down
- `platform_accesses`: UPDATE Owner-only (aligned with INSERT/DELETE).
- `portal_visits`: 
  - INSERT: anon allowed only when portal_id matches an active portal (EXISTS check).
  - SELECT: Owner/Admin only (visitor emails protected).
- `member_sensitive_access`: SELECT Owner-only (don't expose who has elevated access).
- `page_access_grants`: SELECT = own grants OR Owner.

### Views for future field-level restriction
Created `clients_public`, `team_members_public`, `suppliers_public`, `business_setup_public`, `client_contacts_public` (security_invoker=on) excluding NIF/IBAN/morada fiscal/whatsapp/birthday/payment_method/settlement/etc. App can adopt these views progressively to restrict non-Owner members.

## Accepted findings (won't fix — by design)
- PII readable by authenticated team on `clients`, `team_members`, `business_setup`, `suppliers`, `client_contacts`: single-tenant trust model. Mitigation = `*_public` views available.
- `pg_net` in public schema: managed by Supabase platform, used by cron HTTP/webhooks.
- 3 portal buckets public-readable: intentional (brand assets, public materials).

## Earlier history (kept for reference)

### 2026-04-21 — Auditoria 6 Fase A/B (sensitive lockdown + USING true cleanup)
Restringido a Owner OU `current_user_has_sensitive_access`:
- `financial_expenses`, `financial_subscriptions`, `financial_categories` (writes).
- `feedback_sessions`, `performance_monthly`, `client_contacts` (writes Owner/Admin).
Loop dinâmico substituiu USING(true) WITH CHECK(true) em ~95 tabelas operacionais por checks `auth.uid() IS NOT NULL`. Linter: 195→59 warnings.

### 2026-04-21 — Auditoria 2 (Security & RLS)
- Portal anon access removed; reads via SECURITY DEFINER RPCs (`get_portal_*`, `portal_*` writes).
- `client_portals.last_visit_at` only via `portal_record_visit` RPC.

### 2026-04-20 — manage-access-password edge function
AES-GCM with role gate (owner/admin/manager → 403), audit table, rate limit (20/h), failure block (5 denied/30min → block), `ACCESS_ENCRYPTION_KEY` only, CORS via `ALLOWED_ORIGIN`, JWT verify_jwt=true.

### 2026-03-29 — Cron auth guards + query safety
- 7 cron edge functions: service-role auth check.
- ~18 `.single()` → `.maybeSingle()` conversions.
- 25 indexes on hot columns.

### 2026-03-25 — Initial RLS hardening
23 tables: `ALL USING (true)` → owner-only mutations + authenticated read.

## Helper functions (SECURITY DEFINER, search_path=public)
- `has_role(_user_id, _role)` — check role.
- `current_user_has_sensitive_access(_category)` — check `member_sensitive_access`.
- `is_self_team_member(_member_id)` — own team_members row.
- `portal_token_active(_token)` — active portal token check.
