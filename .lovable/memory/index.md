Design system: white-label HQ business management app. Matte ceramic surfaces, Geist/Inter defaults, HSL CSS variables injected from business_settings table.

## Schema
- business_settings: stores theme (colors HSL, fonts, logo_url, business_name)
- user_roles: links users to app_role enum (owner/admin/member)
- custom_roles: Owner-defined named roles
- role_permissions: maps custom_role to module_key + can_view
- members: links user to custom_role
- profiles: auto-created on signup via trigger
- internal_documents: title, category, content, file_url, created_by, timestamps
- routines.sop_id: links routine to its step-by-step SOP

## Auth Flow
1. No user → AuthPage (login/signup)
2. No business_settings → SetupPage (first user becomes Owner)
3. Setup complete → AppLayout with sidebar

## Departments (shared via src/lib/departments.ts)
administrativo, marketing, comercial, clientes, financeiro, operacao, produtos, customer-success, recursos-humanos

## Module Keys
comeca-aqui, agenda, reunioes, processos, projetos, tarefas, acessos, mural, biblioteca, administrativo, marketing, financeiro, comercial, clientes, equipa, operacao, produtos, customer-success, recursos-humanos, planeamento, weekly-align, gestao-equipa-ceo

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
- Routines create linked SOPs that count in total SOP count
