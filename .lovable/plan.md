# Recolhas configuráveis por produto + Timeline no portal

## Conceito

A tabela atual de NPS dentro do produto (Customer Success) passa a ser **"Recolhas de feedback"** — cada linha define uma recolha agendada com:

- **Tipo**: `nps` (só score 0–10) ou `feedback` (perguntas + NPS final)
- **Quando**: dias após início, mês X, ou data fixa (mantém lógica atual)
- **Perguntas** (só se tipo=feedback): lista configurável

O cron diário continua a materializar os registos `por_fazer` por cliente. Na aba **"A tua opinião"** do portal, o cliente vê **toda a sua jornada de recolhas** (passadas preenchidas + atuais por preencher + futuras agendadas só visualmente) e preenche as devidas.

## Schema (migrações)

### 1. `client_nps_records` ganha `kind` e `responses`
- `kind text not null default 'nps'` — `'nps' | 'feedback'`
- `responses jsonb` — respostas às perguntas quando `kind='feedback'` (formato `[{question, answer}]`)
- A coluna `nps_score` continua opcional na tabela mas obrigatória no submit (mesmo no feedback final).

### 2. Config no produto
Verificar a tabela atual que define a cadência (provavelmente `product_nps_schedule` ou similar — confirmar no migrations). Adicionar:
- `kind text not null default 'nps'`
- `questions jsonb` — array de perguntas (`[{id, text, required}]`); só aplicável se `kind='feedback'`
- `title text` — título amigável (ex: "Pulse 30 dias", "Feedback final")

O cron de geração lê `kind` e `questions` e copia para o registo gerado em `client_nps_records`.

## Backend (RPCs)

### Atualizar
- `portal_get_pending_nps` → renomear semanticamente para `portal_get_recolhas`. Devolve **todas** as recolhas do cliente (qualquer status), com `kind`, `questions`, `expected_date`, `actual_date`, `status`, `nps_score`, `responses`, `title`, `product_name`. Ordenado por `expected_date` asc.
- `portal_submit_nps` → aceita `_responses jsonb default null`. Valida que se o registo é `kind='feedback'` as `responses` cobrem perguntas required.
- Remover `portal_submit_proactive_nps` (criada na iteração anterior — já não faz sentido com a cadência configurada).

## Frontend

### Produto › Customer Success (`/hub/produtos/:id`)
A tab atual de NPS passa a chamar-se **"Recolhas de Feedback"**. Cada linha permite:
- Selecionar tipo (NPS / Feedback)
- Definir título e quando (lógica existente)
- Se Feedback: editor inline de perguntas (add/remove/reorder, marca required)

### Portal › "A tua opinião" (`PortalFeedbackSection.tsx`)
Layout em 3 grupos (timeline vertical):

1. **Por preencher** (em destaque, no topo) — cards expansíveis. Para `kind=nps` mostra escala 0–10 + nota. Para `kind=feedback` mostra perguntas + escala final.
2. **Já preenchidas** — resumo compacto (data, score, kind, link para ver respostas).
3. **Próximas agendadas** — lista cinzenta read-only com data prevista e tipo (cliente vê o roadmap mas não preenche).

A secção de **feedback livre** (Elogio/Sugestão/Problema/Outro) mantém-se em baixo, sempre disponível — é independente das recolhas estruturadas.

## Detalhes técnicos

- O `submitNps` no `PortalView.tsx` aceita `responses?: Array<{question, answer}>` e envia ao RPC.
- Tipos novos em `src/types/portal.ts`: `PortalRecolha` substitui `PortalNpsPending`/`PortalNpsHistory`.
- Reverter a função SQL `portal_submit_proactive_nps` (drop) e o respetivo branch no `submitNps`.
- O cron existente que cria registos NPS passa a copiar `kind`, `questions` e `title` da config.

## Fora de scope (próxima iteração)
- Dashboard agregado de respostas de feedback na aba de cliente (já existe vista NPS, é só estender com `kind` filter).
- Templates de perguntas reutilizáveis entre produtos.
