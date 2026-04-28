---
name: department-colors
description: Notion-style inline color picker for department badges; colors stored in DB
type: feature
---
# Department Colors

Cores das etiquetas de departamento são editáveis inline (estilo Notion).

## Tabela
- `department_colors` (department_value UNIQUE, color_key)
- RLS: SELECT autenticados; INSERT/UPDATE/DELETE só `is_admin_or_owner()`
- Seed inicial corresponde às cores legadas em `src/lib/departments.ts`

## Paleta
`src/lib/departmentColorPalette.ts` — 12 cores semânticas (gray/red/orange/amber/yellow/green/teal/blue/indigo/violet/pink/brown). Usa tokens do design system + Tailwind palette para cores não-semânticas (yellow/teal/indigo/pink/brown).

## Hook
`useDepartmentColors()` — cache em memória + listeners; `getBadgeClass(deptValue)`, `getColorKey`, `setColor(dept, key)` (upsert otimista).

## Componente
`<DepartmentBadge department="..." stopPropagation />` — badge com popover picker. Apenas Owner/Admin podem editar (via `useAuth().isAdminOrOwner`); restantes veem badge não-clicável.

## Sítios integrados
- TaskTable (coluna Departamento)
- ResponsavelView (coluna Departamento)
- TaskFormDialog (select usa `getBadgeClass` dinâmico em trigger e itens)

A cor é global por departamento — alterar num sítio reflete em toda a app.
