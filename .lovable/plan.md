## Cockpit Mensal — redesign

A vista actual é fofa demais para servir de planeamento e acompanhamento mensal. Proposta de reestruturação por bloco, mantendo a navegação trimestre/mês que já está no topo.

### Nova ordem dos blocos

1. **Objetivos do mês** — tabela
2. **Agenda do mês** — calendário visual
3. **Comercial + Produtos** (fundidos)
4. **Marketing** — com calendário de conteúdo inline
5. **Clientes**
6. **Operação** — com análise operacional
7. **Reflexão e fecho**

(Produtos sai como bloco isolado e passa a viver dentro de Comercial.)

### Bloco 1 — Objetivos do mês (tabela)
Substituir cards por tabela densa: **Objetivo · Área/Departamento · Meta · Atual · % · Estado · Ação**.
Linha clicável abre o detail sheet existente. Filtro rápido por área no topo.

### Bloco 2 — Agenda do mês
Mostrar mesmo agenda: mini-calendário do mês com pontos por dia (reuniões, deadlines, eventos), e à direita lista cronológica das próximas 10 ocorrências (reuniões, entregas de projeto, deadlines fiscais, lançamentos). Hoje só mostra contadores.

### Bloco 3 — Comercial + Produtos
- KPIs: receita do mês, novas vendas, pipeline, taxa de conversão
- Tabela **Vendas por produto** (qtd, receita, ticket médio, % do total)
- Pipeline por estágio com valor agregado
- Lista das vendas mais recentes
- Produtos ativos com quick-stats (vendas mês, clientes ativos)

### Bloco 4 — Marketing
- KPIs: leads do mês, custo por lead, conversão lead→cliente
- **Calendário de conteúdo do mês** (grid 7 colunas, conteúdos planeados/publicados por dia)
- Funis ativos com performance
- Campanhas/automações em curso

### Bloco 5 — Clientes
- KPIs: ativos, novos no mês, em offboarding, NPS
- Tabela: clientes com aniversário de contrato no mês, renovações pendentes, onboardings em curso
- Alertas: clientes sem actividade > X dias

### Bloco 6 — Operação
- KPIs: projetos ativos, entregas no mês, tarefas concluídas vs planeadas, ocupação da equipa
- **Análise operacional**: distribuição de horas por área/cliente, tarefas atrasadas, gargalos por membro
- Rotinas executadas no mês

### Bloco 7 — Reflexão e fecho
Mantém-se como está.

### Detalhes técnicos
- Editar `MonthlyCockpit.tsx` para reordenar e remover `BlockProdutos` standalone
- Reescrever `BlockObjetivos` para tabela
- Estender `BlockAgenda` com mini-calendário (componente novo)
- Fundir `BlockProdutos` dentro de `BlockComercial`
- Estender `BlockMarketing` com calendário de conteúdo (lê de `marketing_content_calendar` ou equivalente — verifico schema antes)
- Estender `BlockClientes` e `BlockOperacao` com tabelas e análise

### Nota
Este redesign toca em 6 ficheiros de bloco. Se preferires, fazemos por fases (ex.: começar por Objetivos+Agenda+Comercial, validar, depois o resto) — diz-me.