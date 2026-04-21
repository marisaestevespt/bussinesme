# Memory: index.md
Updated: now

Design system: white-label Lyrata business management app. Matte ceramic surfaces, Geist/Inter defaults, HSL CSS variables injected from business_settings table.

## Brand
- Name: **Lyrata** (L·I·R·A·H = Leveza, Independência, Rotinas, Automações, Human)
- Inspired by the lyre — harmony, orchestration of business areas

## Schema
- business_settings: stores theme (colors HSL, fonts, logo_url, business_name, business_sector)
- user_roles: links users to app_role enum (owner/admin/member)
- custom_roles: Owner-defined named roles
- role_permissions: maps custom_role to module_key + can_view
- members: links user to custom_role
- profiles: auto-created on signup via trigger

## Auth Flow
1. No user → AuthPage (login/signup)
2. No business_settings → SetupPage (first user becomes Owner)
3. Setup complete → AppLayout with sidebar

## Module Keys
comeca-aqui, agenda, reunioes, processos, projetos, tarefas, acessos, mural, administrativo, marketing, financeiro, comercial, clientes, equipa, operacao, planeamento, weekly-align, gestao-equipa-ceo

## Design Tokens
- --brand-primary, --brand-secondary injected from DB
- --font-display, --font-body injected from DB
- --shadow-subtle, --transition-ease defined in index.css
- .hq-card, .hq-surface-sunken, .hq-transition utility classes

## Rules
- No hardcoded colors in components
- Executive Room only visible to Owner
- Owner role cannot be edited/deleted (is_owner=true in custom_roles)
- has_role() is SECURITY DEFINER function for RLS
- business_sector adapts UI terminology, module visibility, and fields per industry

## Memories
- [AI assistant](mem://features/ai-assistant.md) — Lyrata AI floating chat with DB tools for queries and actions
- [Backups](mem://features/backups.md) — Weekly automated backups + reset instance (moved to Backups tab)
- [Brand name](mem://design/brand-name.md) — Lyrata: acronym meaning, lyre symbolism, usage locations
- [Color tokens](mem://design/color-tokens) — Full semantic palette, surfaces, opacity system
- [Cron jobs](mem://features/cron-jobs.md) — Backend cron jobs for auto-status updates, notifications, and data sync
- [Client portal](mem://features/client-portal.md) — Client Portal system: public pages via /portal/[token] with OTP auth
- [Fiscal management](mem://features/fiscal-management.md) — Fiscal deadlines, IVA/IRS/SS rules
- [Meeting types](mem://features/meeting-types.md) — Meeting type enum and distinct layouts per type
- [Monthly reports](mem://features/monthly-reports.md) — Auto monthly reports from all modules, Executive Room UI, cron on 2nd
- [New client flow](mem://features/new-client-flow.md) — Lead conversion auto-creates project, portal with FAQs
- [Onboarding system](mem://features/onboarding-system.md) — Onboarding tour and setup wizard
- [Pagination](mem://features/pagination.md) — Infinite scroll pagination system
- [Payment generator](mem://features/payment-generator.md) — Payment generator logic in ProjectGestaoTab
- [Permissions system](mem://features/permissions-system.md) — Multi-dept, sensitive access, per-page grants
- [Planning improvements](mem://features/planning-improvements.md) — Planning module improvements
- [Phases flow](mem://features/phases-flow.md) — Product→Project→Portal phases/deliverables single source of truth
- [Product deliverable templates](mem://features/product-deliverable-templates.md) — Product deliverable templates
- [Product project config](mem://features/product-project-config.md) — Products define default_project_mode and task_mode that auto-fill projects
- [Products](mem://features/produtos.md) — Product detail page structure and tab organization
- [Routines system](mem://features/routines-system.md) — Routines auto-generate tasks via daily cron; managed in Tarefas > Rotinas tab
- [Secretaria refactor](mem://features/secretaria-refactor.md) — Secretaria.tsx refactored to lazy-loaded tabs
- [Sector config](mem://features/sector-config.md) — business_sector adapts terminology, modules, fields per industry
- [Security audit](mem://features/security-audit.md) — RLS hardening for 23 tables
- [SS Independente](mem://features/ss-independente.md) — Correct quarterly declaration mapping: Q1→Abr-Jun, Q2→Jul-Set, Q3→Out-Dez, Q4→Jan-Mar(+1)
- [System efficiency](mem://features/system-efficiency.md) — Observability, tests, onboarding tour
- [Team management refactor](mem://features/team-management-refactor.md) — Team management refactoring
- [Unified expenses](mem://features/unified-expenses.md) — Subscriptions merged into financial_expenses with is_recurring, periodicity, monthly_equivalent
- [Unified responsibilities](mem://features/unified-responsibilities.md) — Aggregates items from 8 DB sources
- [Work areas](mem://features/work-areas.md) — Team member work areas system
- [Member offboarding](mem://features/member-offboarding.md) — Team member offboarding: reassignment, settlement, auto-revoke, ex-members tab
- [Microcopy](mem://design/microcopy.md) — Tom de voz PT-PT informal "tu". Toasts: particípio para sucesso, causa+ação para erro. Validações curtas. useConfirm para destrutivas.
