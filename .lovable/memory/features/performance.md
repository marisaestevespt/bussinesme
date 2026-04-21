---
name: performance-optimizations
description: Code-splitting via React.lazy on all 60+ routes + Vite manualChunks for vendor libs
type: feature
---
Performance optimizations applied (Audit 5):

## Code-splitting
- All ~60 page components in `src/App.tsx` use `React.lazy()` + `Suspense` with a `PageLoader` fallback.
- Eager-only (boot-critical): `AuthPage`, `SetupPage`, `NotFound`, `ResetPasswordPage`, `SuspensionScreen`, `FloatingTimer`.
- Result: initial JS bundle drops dramatically; each route loads its own chunk on demand.

## Vendor chunking (vite.config.ts)
- `react-vendor`: react, react-dom, react-router-dom
- `query-vendor`: @tanstack/react-query
- `supabase-vendor`: @supabase/supabase-js
- `chunkSizeWarningLimit`: 1000 KB

## Backend (DB) — healthy
Audit 5 (DB): all tables <200 rows, only 2 tables with seq_scan > idx_scan
(portal_initial_questions, sop_steps) and both small enough that no new indexes
are needed. Existing indexes are sufficient for current scale.
