## Objetivo

Garantir que todos os locais do sistema onde o utilizador edita um valor existente sigam o **mesmo padrão visual e de interação**:

- Mostra o texto **estático** (sem caixa de input visível)
- Ao passar o rato (hover): aparece o ícone de **lápis** + fundo subtil
- Clique entra em modo edição (input/textarea)
- Texto **nunca corta** — palavras longas e respostas longas quebram em várias linhas
- Guarda no `onBlur` ou `Enter` (Esc cancela)

Componente base já existente: `src/components/product/InlineField.tsx` (já com modo `multiline`).

## O que NÃO entra

Estes inputs continuam como caixas normais (faz sentido manter):

- **Login / Signup / Reset password** (`AuthPage`, `ResetPassword`)
- **Setup wizard** (`SetupPage`)
- **Diálogos de criação** (TaskFormDialog, dialogs de "Nova X") — o utilizador está a criar do zero, não a editar
- **Campos de pesquisa/filtros** (search bars, filtros)
- **Selects, datepickers, checkboxes** (não são texto livre)
- **Editores ricos / brain dump** (já têm UX próprio)

## Abordagem em 3 fases

### Fase 1 — Reforçar o componente base
Promover `InlineField` para localização partilhada e adicionar variantes que cobrem os casos atuais:

- Mover de `src/components/product/InlineField.tsx` → `src/components/ui/inline-field.tsx`
- Re-export do caminho antigo para não partir imports existentes
- Adicionar props que faltam: `rows` (multiline), `maxLines`, `prefix`, `emptyLabel`
- Garantir wrap de palavras (`break-words`, `whitespace-pre-wrap`) no modo multiline (já feito)
- Acessibilidade: `aria-label`, foco visível, suporte teclado (Enter para editar)

### Fase 2 — Páginas de detalhe (prioridade alta — é onde o problema mais aparece)

São as páginas onde se vê o "registo" e se editam campos um a um. Converter todos os `Input`/`Textarea` de edição para `InlineField`:

1. `ProdutoDetail.tsx` (parcial — falta resto da ficha)
2. `ClienteDetail.tsx`
3. `ProjetoDetail.tsx`
4. `LeadDetail.tsx`
5. `VendaDetail.tsx`
6. `ReuniaoDetail.tsx`
7. `SopDetail.tsx`
8. `ConteudoDetail.tsx`
9. `TrafegoCriativoDetail.tsx`, `TrafegoReportDetail.tsx`
10. `MarketingFunilDetail.tsx`
11. `Fornecedores.tsx` (linhas editáveis)

Para cada uma:
- Substituir `<Input value … onChange …>` solto por `<InlineField value … onSave …>`
- Substituir `<Textarea value … onChange …>` por `<InlineField multiline value … onSave …>`
- Manter inputs dentro de modais "Adicionar/Criar"

### Fase 3 — Secções compartilhadas e tabelas

Componentes reutilizados em várias páginas:

- `ProductComercialSection`, `ProductPricingEditor`, `VariablesWizard`
- `CustomFieldsSection`
- `SopEditableLists`, `LinkedSopsSection`, `RenewalSection`
- `DepartmentProcessos`
- `RotinasView`, `HistoricoView`, `MyTasksTable`, `TaskCustomViews`
- `SecretariaWidgets`, `SecretariaProdutividade`
- `ObjetivoFinalField`
- `ExecutiveInnovation`, `ExecutiveBusinessPlanBlock`, `ExecutiveWeeklyAlign`
- `MarketingEstrategia`, `MarketingFunis`, `MarketingDashboard`, `ChannelPage`
- `ComercialAnalise`, `ClientesAnalise`, `CrmPipelines`
- `ComecaAqui`, `Agenda`, `Tarefas`, `Reunioes`, `Projetos`, `Acessos`, `GestaoMarca`

Mesma regra: só os campos que editam um valor já existente.

## Como vou medir progresso

- No final de cada fase: `rg "<Input " src/<scope>` para confirmar que só restam inputs em locais legítimos (modais, filtros, auth)
- Verificação visual: abrir as páginas-chave e confirmar comportamento
- Build limpo

## Detalhes técnicos

`InlineField` já trata:
- `text` / `number` / `multiline`
- Format / suffix / align / bold
- Hover pencil + truncate (single-line) ou wrap (multiline)
- Save on blur, Enter commits, Esc cancela

Para casos especiais (ex: select inline) criarei `<InlineSelect>` análogo se aparecerem (Pricing tem alguns selects).

## Tempo / risco

Fase 1: pequena (1 ficheiro).
Fase 2: ~11 páginas, conversões mecânicas mas extensas. Risco baixo — mantém os mesmos handlers de save.
Fase 3: ~30 ficheiros — fica para depois das páginas de detalhe estarem todas validadas, ou pode ser feita gradualmente conforme o uso.

## Proposta de execução

Posso avançar com **Fase 1 + Fase 2 já neste turno** (pages de detalhe — o sítio onde o problema dói mais).
A Fase 3 seria um segundo turno depois de validares o resultado nas páginas de detalhe.

Confirma se queres que avance assim, ou se preferes uma ordem diferente (ex: começar pelo módulo X).
