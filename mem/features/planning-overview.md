---
name: Planning structure
description: Three-tier planning structure (Estratégico/Tático/Operacional) with dedicated routes
type: feature
---

Hub: `/executive/planeamento` mantém pulse cards + cascata de 3 horizontes.

Cada bloco da cascata leva à sua página dedicada:

1. **Estratégico** — `/executive/planeamento/estrategico`
   Define o negócio. Atalho para canvas (`/executive/business-plan`) + embed de `<StrategicSection />` (Visão LP / MVV / SWOT — sync com business_settings, brand_swot_items, strategic_directives).

2. **Tático** — `/executive/planeamento/tatico`
   Define o plano. Mostra **só** a lista de áreas (`<TacticalByAreaView />`). Cada linha de área tem nome+botão clicáveis para `/planeamento/dep/:area`, onde estão os objetivos anuais, metas e projetos da área (PlaneamentoDepartamento).

3. **Operacional** — `/executive/planeamento/operacional`
   Gere a operação. Trimestral em cima (`<QuarterlyGallery />`) + Mensal em baixo (`<MonthlyGallery />` → drill-down para `MonthDetailView`).

A página tática já não mostra Objetivos Anuais globais nem Mensal nem Metas globais — tudo isso passou a viver na página da área (drill-down) ou no Operacional.
