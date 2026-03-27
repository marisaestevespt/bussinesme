# Project Memory

## Core
System name is Lirah. Portuguese UI. Supabase backend via Lovable Cloud.
Pagination: use useInfiniteSupabaseQuery + InfiniteScrollList for large tables.
Never store roles on profile table — use user_roles with has_role() function.
Products use product_sub_tables pattern (features, benefits, objections, etc.).

## Memories
- [Brand name](mem://design/brand-name) — System name is Lirah, an acronym and symbolic reference to the lyre
- [Fiscal management](mem://features/fiscal-management) — Business type (ENI/Empresa), regime, exemptions, team type, accountant config; conditional module visibility
- [Onboarding system](mem://features/onboarding-system) — Multi-step setup wizard for new instances
- [Pagination](mem://features/pagination) — useInfiniteSupabaseQuery + InfiniteScrollList for large tables
- [Planning improvements](mem://features/planning-improvements) — Planning objectives with sources, filters, goal tracking
- [Product/deliverable templates](mem://features/product-deliverable-templates) — Product deliverable templates and milestone auto-creation
- [Products](mem://features/produtos) — Product detail page structure and tab organization
- [Team management refactor](mem://features/team-management-refactor) — Split 2410-line ExecutiveGestaoEquipa.tsx into modules
- [Executive room refactor](mem://features/executive-room-refactor) — Executive dashboard restructuring
- [Cron jobs](mem://features/cron-jobs) — Scheduled edge functions for daily tasks
- [Backups](mem://features/backups) — Automated backup system with storage
- [Routines system](mem://features/routines-system) — Routines auto-generate tasks via daily cron
- [Member offboarding](mem://features/member-offboarding) — Reassignment popup, settlement, auto-revoke access
- [Meeting types](mem://features/meeting-types) — Meeting type enum and distinct layouts
- [New client flow](mem://features/new-client-flow) — Lead conversion auto-creates project, portal, payments
- [Payment generator](mem://features/payment-generator) — Payment generator logic in ProjectGestaoTab
- [Security audit](mem://features/security-audit) — RLS hardening for 23 tables
- [System efficiency](mem://features/system-efficiency) — Observability, tests, onboarding tour
- [Secretaria refactor](mem://features/secretaria-refactor) — Refactored from ~1700 to ~260 line orchestrator
- [Permissions system](mem://features/permissions-system) — Multi-dept, sensitive access, per-page grants
- [Work areas](mem://features/work-areas) — Members can have multiple work_areas
- [Client portal](mem://features/client-portal) — Public pages for clients via /portal/[token] with OTP
- [Unified responsibilities](mem://features/unified-responsibilities) — Aggregates items from 8 DB sources
