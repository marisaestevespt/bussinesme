
## AI Inteligente na Plataforma Lirah

### Arquitetura
Uma **edge function `ai-insights`** que recebe um contexto (ex: "executive", "financial", "commercial") e:
1. Consulta dados relevantes da base de dados
2. Envia para o modelo AI com um system prompt especializado
3. Retorna insights estruturados

Usa **Lovable AI** (já configurado, sem necessidade de API keys adicionais).

### Fase 1 — Relatórios Inteligentes (Briefing Executivo)
- Botão "Gerar briefing AI" na **Sala Executiva**
- Puxa dados: vendas do mês, clientes novos/perdidos, tarefas atrasadas, KPIs, métricas financeiras
- AI gera um resumo executivo com:
  - Estado geral do negócio (semáforo)
  - Top 3 wins do período
  - Top 3 riscos/problemas
  - Ações sugeridas

### Fase 2 — Sugestões e Alertas Proativos
- Widget na **Secretária** (dashboard principal) com alertas gerados por AI
- Analisa padrões: clientes sem NPS, tarefas vencidas, queda de vendas, pagamentos em atraso
- Cada alerta tem ação sugerida e link direto para resolver
- Atualiza 1x por dia (cron) ou a pedido

### Fase 3 — Análise de Dados com AI
- Botão "Analisar com AI" nas páginas de:
  - **Financeiro** → análise de cash flow, tendências de despesas
  - **Comercial** → taxa de conversão, pipeline health
  - **Marketing** → performance de conteúdos, engagement trends
- Resultados aparecem num painel lateral com insights e gráficos sugeridos

### Implementação técnica
- 1 edge function com routing interno por tipo de análise
- System prompts especializados por área
- Dados passados como contexto JSON (sem acesso direto à DB pelo AI)
- Cache de resultados para evitar chamadas repetidas
