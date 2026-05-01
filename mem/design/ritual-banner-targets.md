---
name: ritual-banner-targets
description: RitualBanner do Executive deve abrir SEMPRE a vista mais específica possível (mês corrente, semana, trimestre) — nunca a página índice de planeamento
type: design
---
# Targets do RitualBanner (Executive Cockpit)

Componente: `src/components/executive/cockpit/RitualBanner.tsx`.

## Regra
Cada variante do banner contextual DEVE apontar para a vista mais específica
disponível, não para a página índice. O CTA está a empurrar para uma ação
concreta naquele momento — abrir um índice obriga a mais um clique.

| Variante | CTA correto | URL alvo |
|---|---|---|
| Início trimestre | "Abrir Plano de Negócio" | `/executive/business-plan` |
| **Mês novo** | "Abrir <Mês>" | `/executive/planeamento/operacional?ano=YYYY&mes=M` (1-12) |
| Weekly Align dia | "Fazer Weekly Align" | `/executive/weekly-align` |
| Véspera Weekly | "Preparar Weekly Align" | `/executive/weekly-align` |

## Why
O utilizador reportou que o banner "Mês novo — define o foco de Maio" abria
`/executive/planeamento` (índice) em vez do detalhe do mês. CTAs de ritual
têm de aterrar no contexto certo.

## Como aplicar
- `ExecutivePlaneamentoOperacional` aceita `?ano=YYYY` e `?mes=1..12` na URL.
- `MonthlyGallery` recebe `initialMonth` (0-11) e `onMonthChange` para
  sincronizar o detalhe selecionado com a URL.
- Ao adicionar nova variante de banner: usar params querystring para
  pré-selecionar a vista (ano, mês, trimestre, semana). NUNCA aterrar
  num índice se houver vista detalhada para o contexto.
