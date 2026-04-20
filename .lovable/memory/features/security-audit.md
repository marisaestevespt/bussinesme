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

## Remaining USING(true) tables (by design)
Operational tables intentionally allow all authenticated members full CRUD — correct for single-tenant team app.
