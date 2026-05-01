---
name: department-planning-card
description: Cartão "Planeamento" de cada departamento vive na grelha principal de botões (Marketing 360 / SECTIONS / NavRow), NÃO no header — fonte única em src/lib/department-planning.ts
type: design
---
# Cartão Planeamento por departamento

## Regra
Cada dashboard de departamento que tenha página de planeamento DEVE expor o
acesso através de um cartão na grelha principal de botões (Marketing 360,
SECTIONS, NavRow, etc.), **NÃO** como chip/link no `PageHeader`.

## Why
O utilizador pediu explicitamente que o link "Planeamento", que estava como
chip discreto abaixo do título via `DepartmentLinks`, passasse para os
"botões principais" — porque era invisível e tratado como link externo
em vez de funcionalidade central. Links rápidos no header são para
recursos externos (Drive, Notion, WhatsApp), não páginas internas.

## Como aplicar
1. Importar de `@/lib/department-planning`:
   ```ts
   import { getPlanningSection } from '@/lib/department-planning';
   ```
2. Adicionar como **primeiro** item do array de secções/cartões da página,
   adaptando os campos ao formato local (path/label/icon/iconColor/color
   ou title/desc/icon/url):
   ```ts
   const SECTIONS = [
     (() => { const p = getPlanningSection('comercial');
       return { path: p.path, label: p.label, icon: p.icon, iconColor: p.iconColor, color: p.color }; })(),
     // ... resto
   ];
   ```
3. **PROIBIDO** voltar a colocar chip Planeamento em `DepartmentLinks` /
   `PageHeader`. O comentário em `DepartmentLinks.tsx` reforça isto.
4. Lista canónica de departamentos com planeamento: `PLANNING_DEPTS` no
   mesmo ficheiro. Adicionar lá quando criar nova página de planeamento.

## Onde está aplicado
- `src/pages/Comercial.tsx` (SECTIONS)
- `src/pages/MarketingDashboard.tsx` (MARKETING_360)
- `src/components/financial/finOverview/sections.ts` (ALL_SECTIONS_ROW1)
- `src/pages/Clientes.tsx` (array inline)
- `src/pages/Operacao.tsx` (cartão dedicado entre PageHeader e KPIs)
