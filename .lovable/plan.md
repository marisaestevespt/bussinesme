# Melhoria UI/UX da Ficha de Produto

Objetivo: reduzir duplicação, baixar densidade visual, simplificar formulários e padronizar a aparência das 9 tabs (O Produto · Operação · Branding · Marketing · Comercial · Contabilidade & Pricing · Clientes & Métricas · Processos · Backoffice).

## Fase 1 — Padrões partilhados (base para todas as tabs)

Criar/consolidar 4 componentes reutilizáveis em `src/components/product/_shared/`:

1. **`ProductTabHeader`** — título + descrição curta + ações à direita (botão primário + menu). Substitui os vários "headers" inconsistentes que cada secção desenha hoje.
2. **`ProductSectionCard`** — card uniforme com ícone, título, descrição opcional, slot de ação (ex: "Adicionar"), e estado vazio embutido. Todas as subsecções passam a usar isto em vez de `Card` cru.
3. **`ProductEmptyState`** — ilustração leve + título + 1 frase + CTA. Padroniza os ~15 empty states diferentes que existem hoje.
4. **`ProductInlineEditField`** — campo que mostra valor + lápis para editar inline (sem abrir modal/dialog para coisas pequenas). Reduz fricção de preenchimento.

Tokens: tudo via `--primary`, `--muted`, `hq-card`, `hq-surface-sunken`. Spacing scale oficial (4/8/16/24).

## Fase 2 — Eliminar duplicações entre tabs

Auditoria do código actual: a maioria das duplicações listadas já não existem.

| Conteúdo | Estado |
|---|---|
| Cliente do produto | ✅ Só em Clientes&Métricas (`ProductSalesTab` agrega) |
| Cores/logo / Welcome Email | ✅ Já lê de Branding |
| Pricing/tiers | ✅ Só em Contabilidade (Sales Kit não tem) |
| Projetos / Métricas | ✅ Só em Clientes&Métricas |
| FAQs | ✅ Só em "O Produto"; portal lê de lá |
| Documentos + Links + Notas | ⚠️ Backoffice ainda renderiza `ProductBackofficeSection` + `ProductArquivoSection` em separado — unificar na Fase 3 (Backoffice) |

Conclusão: **Fase 2 considerada cumprida**. A unificação documentos/links/notas fica integrada na Fase 3 (Backoffice).

## Fase 3 — Reorganização interna por tab (densidade + leitura)

Padrão visual: cada tab passa a ter **layout 12-col** com sidebar esquerda fina (índice/sumário) + conteúdo principal. Subsecções colapsáveis quando >3.

- **O Produto** — Hero com nome+descrição editável inline · 3 cards (Sobre · Incluído · FAQs) · Datas importantes em timeline horizontal compacta.
- **Operação** — Toggle "Recorrente | Por projeto" no topo, lista de templates como tabela densa com inline edit.
- **Branding** — 2 colunas: Identidade visual (cores/logo/fonte) à esquerda, Preview portal+email à direita.
- **Marketing** — Sub-tabs (Sales page · Conteúdo · Funis · Automações · Tráfego) em vez de scroll infinito.
- **Comercial** — Concorrentes em tabela, Sales kit em accordion (Pitch/Benefícios/Materiais/Objeções/Cases).
- **Contabilidade & Pricing** — Pricing tiers em cards lado-a-lado; custos em tabela; métodos de pagamento em chips.
- **Clientes & Métricas** — KPIs no topo (4 cards) · Lista de clientes ativos · Projetos ativos · Customer Success notes.
- **Processos** — SOPs agrupados por fase (Onboarding/Execução/Offboarding) em accordion.
- **Backoffice** — 2 colunas: Links úteis + Reuniões à esquerda; Documentos/Arquivo + Notas/Brainstorming à direita.

## Fase 4 — Reduzir campos a preencher

- Auto-fill: descrições curtas defaultam de campos longos truncados.
- Smart defaults: cores do welcome email puxam de Branding (já feito), fonte idem, logo idem.
- Campos opcionais escondidos atrás de "Mostrar mais campos".
- Substituir dialogs grandes por `ProductInlineEditField` quando campo único.

## Ordem de execução

1. Fase 1 (componentes partilhados) — base sem regressões visíveis ainda.
2. Fase 2 (remover duplicações) — wins rápidos, ficheiros já existentes.
3. Fase 3 tab-a-tab pela ordem oficial (O Produto → Backoffice). Cada tab num passo separado para revisão.
4. Fase 4 aplicada à medida que cada tab é refeita.

## Notas técnicas

- Sem alterações de schema nem de business logic — só apresentação.
- Usar `EntitySection` existente onde já encaixa, criar `ProductSectionCard` quando precisarmos de slots extra (ação no header, badge de estado).
- Manter compat: cada secção continua a aceitar as mesmas props.
- Confirmar visualmente cada tab no preview antes de seguir para a próxima.

## Pergunta antes de começar

Confirmas que avanço **fase a fase** (paro depois da Fase 1 para mostrares feedback antes da Fase 2)? Ou preferes que faça **tab-a-tab** (Fase 1 + 2 juntas, depois cada tab uma a uma)?
