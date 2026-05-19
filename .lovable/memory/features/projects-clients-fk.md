---
name: projects↔clients embed FK
description: Embed clients em queries de projects precisa de FK explícito (PGRST201)
type: constraint
---

`projects` tem 2 FKs para `clients`: `projects_client_id_fkey` (relação real) e `clients_pending_renewal_project_id_fkey` (renovação pendente, inverso).

Sempre que embeber `clients` num select de `projects`, usar FK explícito:

```ts
supabase.from('projects').select('id, clients!projects_client_id_fkey(full_name)')
```

Sem o hint, PostgREST devolve PGRST201 e a query falha silenciosamente (data=null) — sintoma típico: cards/listas a 0 sem erro visível na UI.

**Why:** já causou bug nos cards da Operação > Análise (todos a 0).
