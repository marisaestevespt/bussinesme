---
name: projects-display-consistency
description: Sempre que listar projetos (em qualquer ecrã), reutilizar StatusBadge / DeptBadge / ProjectDeptBadges de @/pages/Projetos para garantir badges coloridas, cores de status e labels consistentes
type: preference
---
# Consistência visual de Projetos

**Regra:** Qualquer tabela, lista ou card que mostre projetos (Secretaria, Operação, dashboards, etc.) DEVE reutilizar:

- `StatusBadge` de `@/pages/Projetos` para o status (cor + dot)
- `ProjectDeptBadges` (multi) ou `DeptBadge` (single) de `@/pages/Projetos` para departamentos (etiqueta colorida por dept)
- `getTypeInfo(p.type).label` para o tipo

**Why:** O utilizador queixou-se repetidas vezes de "letras pequenas" e "departamentos sem cor" na Secretaria > Os Meus Projetos porque o componente foi escrito do zero em vez de reutilizar `Projetos.tsx`. Toda divergência visual entre listagens de projetos é considerada bug.

**How to apply:**
- Nunca usar `text-[10px]` em badges de projetos. Default: `text-xs` mínimo.
- Nunca renderizar departamento como `<span className="capitalize">{p.department}</span>`. Sempre `<ProjectDeptBadges project={p} />`.
- Se faltar um helper, exportá-lo de `src/pages/Projetos.tsx` em vez de duplicar.
