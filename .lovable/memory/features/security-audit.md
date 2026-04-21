# Memory: features/security-audit.md
Updated: 2026-04-20

Security audit: RLS hardening, cron auth guards, query safety, DB indexes, password edge function hardening.

## Architecture
- Single-tenant: each business = separate Supabase project. No business_id needed.
- Isolation is at infrastructure level, not database level.

## Fixes Applied (2026-03-25)
23 tables changed from `ALL USING (true)` to owner-only mutations + authenticated read.

## Fixes Applied (2026-03-29)

### Portal RLS Fix
- `client_portals` anon UPDATE policy now restricted via WITH CHECK.

### Cron Edge Function Auth Guards
Service-role auth check on 7 cron functions.

### Query Safety
~18 dangerous `.single()` → `.maybeSingle()` conversions.

### Database Indexes
25 indexes on hot columns.

## Fixes Applied (2026-04-20) — manage-access-password hardening

Edge function `supabase/functions/manage-access-password/index.ts` reinforced. AES-GCM kept (team needs to read passwords) but with hard guardrails:

1. **Role gate**: requires `has_role(uid, 'owner'|'admin'|'manager')`. Otherwise 403 + audit `denied`.
2. **Audit table** `public.access_password_audit` (id, user_id, action[read|write|rotate|denied], access_id, ip, user_agent, reason, created_at). RLS: only owners SELECT. Inserts only via service role from edge function.
3. **Rate limit**: 20 calls/h per user_id (counted via audit table). Excess → 429.
4. **Failure block**: 5 `denied` entries in last 30 min → 403 for 30 min.
5. **Encryption key**: only from `ACCESS_ENCRYPTION_KEY` secret. Removed legacy `system_config` fallback.
6. **CORS**: `ALLOWED_ORIGIN` secret (production) + dynamic match for `*.lovable.app` (preview).
7. **JWT verification**: `[functions.manage-access-password] verify_jwt = true` in `supabase/config.toml`.

Secrets used: `ACCESS_ENCRYPTION_KEY`, `ALLOWED_ORIGIN`.

## Fixes Applied (2026-04-21) — Critical RLS hardening

1. **Portal anon access locked behind token RPCs.** Dropped anon `SELECT/INSERT/UPDATE` policies on
   `portal_initial_questions`, `portal_monthly_summaries`, `portal_timeline_phases`,
   `portal_project_history`, `portal_materials`, `portal_faqs`, `portal_comments`, `portal_feedback`.
   Created SECURITY DEFINER token-gated RPCs:
   - Reads: `get_portal_initial_questions`, `get_portal_monthly_summaries`, `get_portal_timeline_phases`,
     `get_portal_materials`, `get_portal_faqs`, `get_portal_comments`, `get_portal_feedback`
   - Writes: `portal_answer_initial_question`, `portal_add_comment`, `portal_submit_feedback`
   `PortalView.tsx` updated to use the RPCs only. Authenticated team-side queries continue via direct table access.

2. **client_portals anon UPDATE removed.** `last_visit_at` updates only via `portal_record_visit` RPC.

3. **member_sensitive_access locked.** Dropped permissive USING(true) INSERT/UPDATE/DELETE policies; only
   owner-role policies remain (privilege escalation closed).

4. **Storage buckets `financial-files` and `library-files` set to private.** Public SELECT removed; only
   authenticated users can read/write.

## Remaining USING(true) tables (by design)
Operational tables intentionally allow all authenticated members full CRUD — correct for single-tenant team app.

## Fixes Applied (2026-04-21) — Auditoria 6 Fase A (Sensitive data lockdown)

Restringido a Owner OU `current_user_has_sensitive_access('financial_values')`:
- `financial_expenses` (SELECT/INSERT/UPDATE)
- `financial_subscriptions` (SELECT/INSERT/UPDATE)
- `financial_categories` (INSERT/DELETE; SELECT mantido para todos)
- `financial_invoices` e `financial_revenues` (SELECT/INSERT/UPDATE/DELETE) — quando existirem

Restringido a Owner OU próprio membro (`is_self_team_member`):
- `feedback_sessions` (SELECT)
- `performance_monthly` (SELECT)

`client_contacts`: SELECT mantido para toda a equipa; INSERT/UPDATE/DELETE só Owner ou Admin.

Tabelas já protegidas anteriormente (sem alteração): payroll, business_setup (sensitive fields), member_contracts, member_payments, suppliers, platform_accesses, team_members.

## Fixes Applied (2026-04-21) — Auditoria 2 (Security & RLS)

Resolved all 12 actionable findings from the Lovable security scan:

1. **client_portals**: Removed anon SELECT policies (`Portal publicly readable by token`, `Anon can view portal by token or slug`). Anon access now exclusively via SECURITY DEFINER RPCs.
2. **platform_accesses**: SELECT restricted to `owner` OR `admin`. Other team members must use `manage-access-password` edge function.
3. **financial_payroll**: SELECT/INSERT/UPDATE restricted to `owner` only.
4. **team_members**: UPDATE restricted to `owner` OR own profile_id (each member edits only themselves; owner edits all). SELECT remains team-wide for directory.
5. **business_setup**: SELECT restricted to `owner`.
6. **member_contracts** + **member_payments**: SELECT restricted to `owner`.
7. **portal_visits**: anon INSERT now requires `portal_id` to belong to an active portal (WITH CHECK against client_portals.is_active).
8. **product_onboarding_templates**: SELECT moved from `public` to `authenticated`.
9. **suppliers**: SELECT for all authenticated; INSERT/UPDATE/DELETE restricted to `owner` OR `admin`.
10. **storage.objects (portal-uploads)**: Dropped anonymous upload policy. Authenticated upload + public SELECT remain.

Note: app_role enum has only `owner`, `admin`, `member` — no `manager` role.

### Refinement after impact analysis

Initial Owner-only locks broke widgets (WeeklyAlign, Secretaria → Contrato, payment methods).
Final policies:
- `business_setup` SELECT: any authenticated user (needed for `payment_methods` everywhere). Sensitive fields gated client-side via `useSensitiveAccess`.
- `financial_payroll` SELECT: Owner OR `current_user_has_sensitive_access('payroll'|'financial_values')`. Writes Owner-only.
- `member_contracts` SELECT: Owner OR sensitive `contracts`/`payroll` OR `is_self_team_member(member_id)`.
- `member_payments` SELECT: Owner OR sensitive `payroll` OR `is_self_team_member(member_id)`.

New SECURITY DEFINER helpers:
- `current_user_has_sensitive_access(_category text)` — checks `member_sensitive_access`.
- `is_self_team_member(_member_id uuid)` — checks if calling user owns that team_members row.
