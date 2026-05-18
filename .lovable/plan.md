# Automação na criação de projetos com produto

## Objetivo
Quando criar um projeto associado a um produto, o sistema clona automaticamente **tudo** o que estiver definido no produto, até ao fim do contrato — sem precisar do botão "Importar do Produto" depois.

## Comportamento

**1. Recorrentes (avenças mensais, ex: Gláuks Diana)**
- Duração do contrato vem do produto (`products.cycle_duration` → `projects.cycle_duration_months`), preenchido automaticamente.
- Clona fases (onboarding + trabalho contínuo + offboarding).
- Clona entregas (`product_deliverable_templates` → `project_deliverables`).
- Gera ocorrências recorrentes (reuniões + tarefas) para todos os meses do ciclo.

**2. Pontuais (ex: Lyrata, Notions)**
- Clona fases.
- Clona entregas.
- **Não** gera ocorrências recorrentes (não faz sentido em pontuais).

## Como (técnico)

Nova função SQL `bootstrap_project_from_product(_project_id)` que:
1. Lê `projects.product_id` e `product_mode`.
2. Se `cycle_duration_months` está vazio → copia de `products.cycle_duration`.
3. Idempotente: só insere se ainda não existirem fases/entregas/ocorrências.
4. Chama `generate_cycle_phases` + `generate_cycle_occurrences` apenas para recorrentes.

Frontend (`Projetos.tsx`):
- Após o `insert` no `projects`, chamar `supabase.rpc('bootstrap_project_from_product', { _project_id })` se houver `product_id`.
- Toast a indicar "Projeto criado com X fases e Y entregas".

## Projetos existentes (Diana, Lyrata, Notions, Bianca)

Sem mudanças automáticas. Já têm fases/entregas/ocorrências populadas — a função é idempotente, portanto se um dia for re-executada manualmente sobre um deles, **não** duplica nem altera nada existente. O único projeto vazio é o "Criação de Novo Produto // Lyrata" (interno, sem cliente, sem `cycle_duration_months`) e fica intocado.

## Confirmar
Sigo com isto? (1 migração + edição em `Projetos.tsx`)
