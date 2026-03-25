Planning system: value sources for automatic objective tracking.

## Available VALUE_SOURCES
| Source | Label | What it tracks | Table | Filtros |
|--------|-------|---------------|-------|---------|
| manual | Manual | User inputs values | — | — |
| metrica | Métrica na Ficha | Linked metric current_value | objective_metrics | — |
| bd_vendas | Faturação (Vendas) | Sum of invoice_total | commercial_sales | product_id |
| bd_crm | Leads ganhos (CRM) | Count of won leads | crm_leads | product_id |
| bd_clientes | Clientes ativos | Count active clients | clients | — |
| bd_tempo | Horas registadas (Timer) | Sum of duration in year | time_entries | category, client_id |
| bd_tarefas | Tarefas concluídas | Count completed tasks in year | tasks | department |
| bd_equipa | Membros da equipa | Count active members | team_members | — |
| bd_marketing | Seguidores (Marketing) | Sum followers latest month | channel_monthly_metrics | channel_id |
| bd_conteudos | Conteúdos publicados | Count published content in year | content_items | channel_id |
| bd_reunioes | Reuniões realizadas | Count meetings (terminada/confirmada) in year | meetings | department |
| bd_nps | NPS médio | Average NPS score in year | client_nps_records | client_id |
| bd_despesas | Despesas totais | Sum of expenses in year | financial_expenses | category |
| bd_projetos | Projetos concluídos | Count completed projects in year | projects | type |

## source_filter column
JSONB column on executive_objectives. Stores contextual filters like `{"category":"cliente"}` or `{"channel_id":"uuid"}`.

## Auto-status on goals
- actual ≥ target → atingido
- month ended + actual < target → nao_atingido
- actual > 0 → em_curso

## primary_metric_id
Column on executive_objectives, FK to objective_metrics. Used when value_source = 'metrica'.
