---
name: AI Insights System
description: AI-powered business insights via Lovable AI gateway - briefings, alerts, and data analysis
type: feature
---
- Edge function `ai-insights` queries DB data and sends to Lovable AI (google/gemini-3-flash-preview) with specialized prompts
- Streaming SSE responses rendered with react-markdown in `AiInsightsPanel` component
- 5 analysis types: executive, alerts, financial, commercial, marketing
- Placement:
  - **Executive Room**: "Gerar briefing AI" button after StrategicMetricsSection
  - **Secretária**: "Ver alertas AI" button in dashboard view (no tab active)
  - **Financeiro**: "Analisar com AI" button before year selector
  - **Comercial**: "Analisar com AI" button after CommercialOverview
- Each type has specialized system prompt for Portuguese business context
- Handles 429 (rate limit) and 402 (credits) errors gracefully
