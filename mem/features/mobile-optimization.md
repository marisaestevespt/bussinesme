---
name: Mobile optimization
description: Mobile UX rules — table contention, responsive grids/typography, bottom nav, TabsBar hidden in mobile
type: feature
---
## Mobile patterns

**Tables**: shadcn `<Table>` (src/components/ui/table.tsx) tem `overflow-x-auto + min-w-[640px] sm:min-w-0 + -mx-4 sm:mx-0`. Funciona dentro de `<Card>` com padding (margem negativa anula em mobile, restaura em sm+).

**Grids tipo-tabela com divs** (sem `<Table>`): meter wrapper `<div className="overflow-x-auto"><div className="min-w-[NNNpx]">...`. Já feito em PortalClientes (960px) e ClientesAnalise (640px).

**Grids responsivos**: `grid-cols-N` puro só para 7 colunas de calendário. Forms/cards: usar `grid-cols-1 sm:grid-cols-3` (3+ colunas com inputs) ou `grid-cols-2 sm:grid-cols-4` (cartões pequenos). KPIs com 3 valores curtos podem manter `grid-cols-3`.

**Tipografia hero**: `text-4xl` → `text-2xl sm:text-3xl md:text-4xl`. `text-3xl` em KPIs → `text-2xl sm:text-3xl`.

## Bottom nav (mobile-only)

Componente: `src/components/MobileBottomNav.tsx`. Visível só `<md:`, fixed bottom-0, h-16, 5 colunas:
1. Secretária  2. Agenda  3. Reuniões  4. Clientes  5. Mais (abre sidebar drawer via `useSidebar().setOpenMobile(true)`)

Suporta `pb-[env(safe-area-inset-bottom)]` para iPhone notch.

## TabsBar

Escondida em mobile (`<div className="hidden sm:block">`) — em telemóvel usa-se a bottom nav, não tabs múltiplas.

## FloatingAiChat

Em mobile o FAB (botão chat) sobe para `bottom-20` (acima da bottom nav). Em `md:` volta a `bottom-5`.

## Main padding

`pb-24 md:pb-10` — extra padding em mobile para conteúdo não ficar tapado pela bottom nav.
