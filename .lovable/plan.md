## Conceito

Cada recolha **NPS** deixa de ter uma única nota 0–10. Em vez disso, o cliente atribui uma nota 0–10 a cada **categoria temática** que **nós** definimos uma vez de forma universal (servem para qualquer produto). A nota global da recolha (a que continua a entrar nas médias e na saúde do cliente) passa a ser a **média das categorias respondidas**.

Cada categoria pertence a um **departamento responsável** (ex.: *Atendimento* → Relação com Clientes; *Qualidade do Produto* → Produto). Quando uma categoria é avaliada **abaixo de 7** (detrator), o portal pede um comentário apenas para essa categoria. Esses comentários são depois mostrados no respetivo departamento como sinais de melhoria.

O **Feedback Final** mantém o seu modelo atual (perguntas livres + nota final) — não toca aí, apenas no kind=`nps`.

---

## Categorias universais (semente inicial)

```text
Atendimento e relação        → relacao_clientes
Clareza no processo          → relacao_clientes
Cumprimento de prazos        → operacao
Qualidade do produto/serviço → produto
Resultado obtido             → produto
Comunicação                  → relacao_clientes
```

Editáveis em **Definições → Recolhas de Feedback** (nova mini-secção). Adicionar/remover/desativar; cada categoria tem `key`, `label`, `department`, `sort_order`, `is_active`.

---

## Schema

**Nova tabela `nps_categories`** (universal, só Owner edita)
- `key` (slug único), `label`, `department` (enum), `sort_order`, `is_active`

**`client_nps_records` ganha:**
- `category_scores` jsonb → `[{ key, score, comment? }, ...]`
- `nps_score` continua a existir, mas para `kind='nps'` passa a ser **calculado automaticamente** pelo backend = média(category_scores.score) arredondada. Para `kind='feedback'` mantém-se o input direto (não muda).

Backfill: registos antigos `kind='nps'` ficam com `category_scores=null` e `nps_score` original — não rebenta nada.

---

## RPCs

- `portal_get_recolhas` → devolve também `categories` (lista universal ativa) só nos registos `por_fazer` `kind='nps'`, e `category_scores` nos concluídos.
- `portal_submit_nps` → para `kind='nps'`, deixa de aceitar `_score` direto e passa a aceitar `_category_scores jsonb` (validação: pelo menos 1 categoria respondida, scores 0–10). Calcula `nps_score = round(avg)`. Para `kind='feedback'` mantém a assinatura atual.

---

## Portal (PortalFeedbackSection)

Dialog do NPS é redesenhado:
- Cabeçalho com título da recolha
- **Lista de categorias**, cada uma com label, descrição curta opcional e seletor 0–10 (mesmo agrupamento Detrator/Passivo/Promotor já implementado, em formato compacto inline)
- Quando uma categoria recebe score ≤ 6, expande **textarea inline** "O que correu menos bem em *X*?" (obrigatório para submeter)
- Resumo no fundo: "Nota global desta recolha: **8.3**"
- Botão Enviar

Feedback Final: zero alterações.

---

## Médias e saúde (impacto)

- **Saúde do cliente, médias por produto, cockpit, ClientesAnalise, ProductMetricsTab** — continuam a ler `nps_score` → **nada muda** porque o backend grava a média lá.
- **Novas vistas por categoria/departamento** (entregue só onde fizer sentido, sem rebuild dos dashboards):
  - **Relação com Clientes (`/hub/clientes/analise`)**: novo bloco "Sinais por categoria" → médias e comentários abertos das categorias com `department='relacao_clientes'` nos últimos 90 dias.
  - **Produto (página do produto, aba Métricas)**: novo bloco "Avaliação por categoria" → médias por categoria limitadas às categorias `department='produto'` para esse produto.
  - **Operação**: já tem analytics próprias; deixar este passo para depois (não no scope agora) para evitar bloat.

---

## Out of scope nesta passagem

- Edição inline das categorias por produto (mantém-se universal)
- Dashboards executivos novos
- Permissões de quem vê comentários (assume-se: equipa toda na fase de teste)

---

## Passos de implementação (técnico)

1. **Migration**: criar `nps_categories`, RLS (Owner R/W; equipa só read), seed inicial; adicionar `category_scores` a `client_nps_records`.
2. **RPCs**: atualizar `portal_get_recolhas` e `portal_submit_nps`; trigger/função para calcular `nps_score` na submissão.
3. **Tipos**: estender `PortalRecolha` em `src/types/portal.ts` com `categories` e `category_scores`.
4. **Portal Dialog**: redesenhar para múltiplas categorias + comentário condicional (≤6).
5. **Definições**: nova mini-secção em `src/components/settings/SettingsRecolhas.tsx` (ou similar) para editar a lista universal.
6. **Análises**: pequenos blocos em ClientesAnalise e ProductMetricsTab a ler agregados de `category_scores`.

Quando aprovares, executo este plano por esta ordem.