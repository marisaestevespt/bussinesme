---
name: planning-period-progress
description: Single source of truth for planning period progress (month/quarter/semester) — never duplicate the formula
type: feature
---
**Função única:** `planning.getPeriodProgress(periodMonths: string[])` em `src/hooks/usePlanningData.tsx`.

Retorna `{ pct, count, achievedCount }` para qualquer conjunto de meses (ex: `['Abril']`, `['Janeiro','Fevereiro','Março']`, ou semestre completo).

**Fórmula por meta:**
- status `atingido` → 100%
- senão → `min(100, round((actual / target) * 100))` onde `actual = goalAutoValue(linkedObj, period) || actual_value` (auto vem das vendas reais para metas comerciais via objetivo ligado)

**Usado em:** MonthlyGallery, QuarterlyGallery (3 sítios), SemesterGallery (4 sítios), MonthDetailView.

**Regra:** NUNCA reescrever este cálculo num componente — chamar sempre `planning.getPeriodProgress()`. Mudanças à fórmula fazem-se só no hook.
