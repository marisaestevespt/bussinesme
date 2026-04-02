## Redesign UI — Lirah Design System

### Contexto
O UI atual tem "cara de IA" — genérico, cores seguras, componentes shadcn sem personalidade. Queremos um visual **colorido, quente e com personalidade** (inspiração Notion/Todoist) mas **mantendo o sistema existente** onde cada negócio aplica as suas cores/logo via `business_settings`.

### Fases (por ordem de impacto)

#### Fase 1 — Fundação do Design System (`index.css` + `tailwind.config.ts`)
- Nova paleta base com tons quentes e vibrantes (âmbar, coral, violeta suave)
- Tokens semânticos mais ricos: surfaces, subtle backgrounds, accent gradients
- As cores do `business_settings` (primary, secondary, accent) continuam a sobrepor os tokens base
- Sombras mais suaves e orgânicas (não as box-shadows genéricas)
- Border-radius mais generoso (12-16px nos cards)

#### Fase 2 — Tipografia e Hierarquia
- Font pairing mais expressivo (ex: display font para títulos, Inter para corpo)
- Escala tipográfica com mais contraste (títulos maiores e mais bold, labels mais discretos)
- Pesos variados: headings bold, subheadings medium, body regular, captions light

#### Fase 3 — Componentes Core
- **Cards**: backgrounds com cor subtle, hover com elevação suave, borders mais leves
- **Tabelas**: rows com alternância de cor, hover mais visível, headers mais distintos
- **Badges/Status**: cores mais vibrantes e distintas, com ícones quando apropriado
- **Buttons**: primary com gradiente subtil, hovers com transição suave
- **Sidebar**: mais personalidade, ícones com cor, active state mais marcado

#### Fase 4 — Micro-interações e Polish
- Transições suaves em hovers, opens, closes (150-300ms)
- Skeleton loaders com shimmer
- Empty states com ilustrações simples ou ícones grandes
- Feedback visual mais rico nos formulários

### Princípios
1. **Identidade dinâmica preservada** — as cores do negócio (`business_settings`) continuam a funcionar como override
2. **Acessibilidade** — contraste WCAG AA mínimo
3. **Progressivo** — cada fase é funcional independentemente
4. **Sem breaking changes** — refinar, não reescrever componentes

### O que NÃO muda
- Estrutura de páginas e routing
- Lógica de negócio
- Funcionalidades existentes

Queres que avance fase a fase, ou preferes que faça tudo de uma vez começando pela Fase 1?