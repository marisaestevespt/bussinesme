---
name: planning-okrs-kpis
description: Estado dos KPIs do planeamento (department_kpis) e novas fontes auto-calculadas
type: feature
---

## value_source disponíveis no resolver useKpiAutoValue.ts

### Base (já existiam)
- `manual`, `metrica`
- `bd_vendas` (commercial_sales), `bd_crm` (crm_leads ganho), `bd_clientes` (clients ativos)
- `bd_tempo`, `bd_tarefas`, `bd_equipa`, `bd_marketing` (followers), `bd_conteudos`
- `bd_reunioes`, `bd_nps`, `bd_despesas`, `bd_projetos`

### Adicionadas em 2026-05-20 (auto-calculadas)
- `bd_crm_conv_sessao` — % leads do período que receberam proposta (product_quotes)
- `bd_crm_conv_proposta` — % propostas que viraram ganho
- `bd_crm_tempo_fecho` — média dias added_at → updated_at em leads ganhos
- `bd_crm_followups` — leads com next_followup vencido e status≠ganho/perdido (global)
- `bd_mkt_alcance_ig` — sum(ig_accounts_reached) em channel_monthly_metrics
- `bd_mkt_views_youtube` — sum(yt_total_views)
- `bd_mkt_save_share` — (saves+shares)/impressions em content_metrics
- `bd_fin_mrr` — vendas de produtos com cycle_renewable=true (média mensal)
- `bd_fin_receita_variavel` — vendas de produtos não recorrentes
- `bd_fin_custos_ratio` — despesas is_recurring / receita total
- `bd_fin_breakeven` — receita - despesas
- `bd_fin_pagamentos_atraso` — despesas não pagas com renewal_date vencida
- `bd_ops_sops_ativos` — count(sops status=ativo)
- `bd_tarefas_p1p2_atraso` — tasks priority∈{alta,media} status≠done deadline<hoje
- `bd_projetos_no_prazo` — % projetos ativos com deadline futuro
- `bd_clientes_fase_media` — média cycle_number (clients ativos via client_renewals)
- `bd_clientes_renovacao` — % atividades client_renewals completed
- `bd_produtos_assinaturas` — clients ativos com produto recorrente (sf.product_id filtra)
- `bd_produtos_ticket_medio` — média invoice_total das vendas (sf.product_id filtra)
- `bd_equipa_execucao_autonoma` — % tasks done sem reatribuição
- `bd_equipa_entregas_a_tempo` — % tasks done concluídas até deadline
- `bd_geral_mrr_ratio` — MRR / faturação total
- `bd_geral_velocidade_mrr` — diff € MRR entre primeiro e último mês do range

## KPIs que ficam manuais (intencional)
- Geral — Capacidade Gláuks disponível (regras de capacidade ainda não definidas)
- Geral — Progresso dos objetivos anuais (depende do cockpit)
- Produtos — Taxa ativação Lyrata pós-consultoria (sem telemetria interna)
- Produtos — Módulos Lyrata utilizados/cliente (sem telemetria interna)

## KPIs removidos em 2026-05-20
- Comercial: Origem dos leads
- Clientes: Dias desde último contacto
- Geral: Horas Marisa: operacional vs estratégia
- Geral: Referências recebidas

## Fluxo UI
ObjectiveDetailSheet → quando objective_metrics.linked_kpi_id existe, mostra leitura via `department_kpi_monthly` em modo read-only e oculta "Nova Meta Mensal".

VALUE_SOURCES (em src/hooks/usePlanningData.tsx) lista todas as fontes incluindo as derivadas — usado no seletor de objetivos.
