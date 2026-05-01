Design system: white-label Lyrata business management app. Matte ceramic surfaces, Geist/Inter defaults, HSL CSS variables injected from business_settings table. AI assistant inside the product is called **Atena**.

## Brand
- System name: **Lyrata** (inspired by the lyre — harmony, orchestration of business areas)
- AI assistant name: **Atena** (Greek goddess of wisdom & strategy; warm, informal, motivating tone)

## Schema
- business_settings: stores theme (colors HSL, fonts, logo_url, business_name)
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
- AI assistant is always called "Atena", never "Lyrata AI" or "Lirah AI"

## Memories
- [Brand name](mem://design/brand-name.md) — Lyrata (system) + Atena (AI assistant): naming, tone, where each appears
- [Color tokens](mem://design/color-tokens) — Full semantic palette, surfaces, opacity system
- [Cron jobs](mem://features/cron-jobs.md) — Backend cron jobs for auto-status updates, notifications, and data sync
- [Client portal](mem://features/client-portal.md) — Client Portal system: public pages via /portal/[token] with OTP auth
- [Fiscal management](mem://features/fiscal-management.md) — Fiscal deadlines, IVA/IRS/SS rules
- [Meeting types](mem://features/meeting-types.md) — Meeting type enum and distinct layouts per type
- [New client flow](mem://features/new-client-flow.md) — Lead conversion auto-creates project, portal with FAQs
- [Onboarding system](mem://features/onboarding-system.md) — Onboarding tour and setup wizard
- [Pagination](mem://features/pagination.md) — Infinite scroll pagination system
- [Payment generator](mem://features/payment-generator.md) — Payment generator logic in ProjectGestaoTab
- [Permissions system](mem://features/permissions-system.md) — Multi-dept, sensitive access, per-page grants
- [Planning improvements](mem://features/planning-improvements.md) — Planning module improvements
- [Planning overview](mem://features/planning-overview.md) — Cascata 3 horizontes + cobertura por 8 áreas no Planeamento
- [Planning period progress](mem://features/planning-period-progress.md) — `planning.getPeriodProgress()` é a fonte única do cálculo de % por período (mês/trimestre/semestre)
- [Product deliverable templates](mem://features/product-deliverable-templates.md) — Product deliverable templates
- [Products](mem://features/produtos.md) — Product detail page structure and tab organization
- [Routines system](mem://features/routines-system.md) — Routines auto-generate tasks via daily cron; managed in Tarefas > Rotinas tab
- [Secretaria refactor](mem://features/secretaria-refactor.md) — Secretaria.tsx refactored to lazy-loaded tabs
- [Security audit](mem://features/security-audit.md) — RLS hardening for 23 tables
- [SS Independente](mem://features/ss-independente.md) — Correct quarterly declaration mapping: Q1→Abr-Jun, Q2→Jul-Set, Q3→Out-Dez, Q4→Jan-Mar(+1)
- [System efficiency](mem://features/system-efficiency.md) — Observability, tests, onboarding tour
- [Team management refactor](mem://features/team-management-refactor.md) — Team management refactoring
- [Unified responsibilities](mem://features/unified-responsibilities.md) — Aggregates items from 8 DB sources
- [Work areas](mem://features/work-areas.md) — Team member work areas system
- [Member offboarding](mem://features/member-offboarding.md) — Team member offboarding: reassignment, settlement, auto-revoke, ex-members tab
- [Deliverable↔task sync](mem://features/deliverable-task-sync.md) — Entregas com responsible_type=equipa auto-geram tarefas ligadas via trigger; conclusão sincroniza nos dois sentidos
- [Batching focus blocks](mem://features/batching-focus-blocks.md) — Secretária tab "Blocos de Foco": agrupa tarefas por cliente/projeto/área para deep-work batched sessions
- [Project detail layout](mem://features/project-detail-layout.md) — Ordem das secções na tab Tarefas & Responsabilidades por tipo de projeto, botões, health badge, título
