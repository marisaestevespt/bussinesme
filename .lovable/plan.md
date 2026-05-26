# Auditoria Pré Go-Live — Plano de Trabalho

Objetivo: garantir que o sistema está pronto para entregar a clientes reais, identificando e corrigindo gaps em **6 frentes**. Cada fase produz um relatório com **achados + correções aplicadas + itens diferidos** (com justificação).

Trabalho faseado para não partir nada — cada fase só avança após a anterior fechar.

---

## Fase 1 — Segurança & RLS (1ª prioridade)

- Auditar as **99 funções SECURITY DEFINER** restantes: confirmar que cada uma faz validação interna de `auth.uid()`/permissões
- Rever **policies RLS de tabelas sensíveis**: `financial_*`, `client_*`, `business_settings`, `user_roles`, `members`, `team_members`, `portal_*`
- Validar **isolamento multi-tenant**: garantir que nenhum user vê dados de outro `business_settings` (se aplicável)
- Verificar **edge functions**: validação JWT, CORS, input validation (Zod), rate limiting nos endpoints públicos do portal
- Auditar **storage buckets**: políticas, public vs private, exposição de ficheiros sensíveis

## Fase 2 — Integridade de Dados

- **Constraints em falta**: `NOT NULL`, `UNIQUE`, `CHECK` em campos críticos (emails, status enums, valores monetários)
- **FKs sem `ON DELETE`**: identificar onde apagar um pai deixa filhos órfãos vs onde devia haver CASCADE/SET NULL explícito
- **Dados órfãos atuais**: linhas em tabelas filhas cujo pai já foi apagado historicamente (não detetado na auditoria anterior, que viu FKs declaradas mas não dangling rows reais)
- **Enums vs valores livres**: campos `status`/`type` em texto livre que deviam ser enums
- **Duplicados lógicos**: e.g. 2 clientes com mesmo NIF, 2 produtos com mesmo nome, 2 leads do mesmo email

## Fase 3 — Automações & Triggers

- Inventariar **todos os triggers + cron jobs** e confirmar que correm sem erros nos últimos 7 dias
- Validar **sync bidirecional anti-loop**: deliverable↔task, meeting↔deliverable, onboarding↔task, expense↔payment, planning↔dept
- Confirmar **edge function crons**: `clone-recurring-phases`, `extend-supplier-expenses`, `ensure-member-payments`, `regenerate-recurring-meetings`, `generate-monthly-report` + os de notificações
- Testar **fluxo de routines**: criar rotina diária → confirmar geração de tarefa amanhã
- Validar **conversão lead → cliente → projeto → portal** end-to-end

## Fase 4 — Performance & Loading

- **Top queries lentas** via `pg_stat_statements` (RPC `admin_top_queries` já existe)
- **Índices em falta**: FKs sem index, colunas usadas em `WHERE`/`ORDER BY` sem cobertura
- **N+1 queries** no frontend: páginas que fazem queries em loop em vez de batch
- **Bundle size + lazy loading**: páginas pesadas, componentes que deviam ser `lazy()`
- **Web Vitals** (LCP, CLS, INP) nas 5 páginas mais usadas: Secretaria, Agenda, Tarefas, Clientes, Reuniões
- **Realtime subscriptions**: confirmar que se desinscrevem no unmount (memory leaks)

## Fase 5 — UX, Loading States & Edge Cases

- **Empty states**: cada lista/tabela tem mensagem decente quando vazia?
- **Loading states**: skeletons consistentes, nada com flash de "no data" antes do load
- **Error boundaries**: páginas que crasham silenciosamente?
- **Permissões na UI**: utilizador sem permissão para um módulo vê erro feio ou redirect limpo?
- **Mobile responsiveness**: top 10 páginas testadas em viewport 375px
- **Formulários**: validação client-side, mensagens de erro claras, disabled durante submit

## Fase 6 — Onboarding & Fluxo de Primeiro Cliente

- **Setup wizard completo** num tenant novo do zero
- **Tour de onboarding** dispara nos sítios certos
- **Convite de membro**: email chega, link funciona, role atribuído
- **Portal do cliente**: criar cliente → gerar portal → cliente recebe OTP → entra → vê só o seu projeto
- **Documentos default**: SOPs, templates, FAQs aparecem prontos a usar
- **Reset/limpeza**: existe forma do owner limpar dados de teste antes de operar a sério?

---

## Como vou trabalhar

Em cada fase:
1. **Levantamento** (read-only queries + leitura de código)
2. **Relatório de achados** classificado por severidade: 🔴 bloqueador / 🟡 importante / 🟢 nice-to-have
3. **Tu decides** o que corrigir agora vs adiar
4. **Aplico correções** apenas das aprovadas
5. **Re-validação** + atualização da memória do projeto

## Tempo estimado

- Fase 1 (Segurança): mais densa, ~40% do esforço total
- Fases 2-3 (Dados + Automações): ~30%
- Fases 4-5 (Performance + UX): ~25%
- Fase 6 (Onboarding E2E): ~5% — faz-se uma vez no fim

## O que NÃO faço sem perguntar

- Apagar dados (mesmo órfãos)
- Mudar enums ou tipos de colunas existentes
- Refactors estruturais grandes (e.g. migrar tabelas)
- Mudar policies RLS em tabelas com dados reais sem teste prévio

Tudo isto fica em "achados a discutir" no relatório.

---

## Decisões que preciso de ti antes de começar

1. **Começo pela Fase 1 (Segurança) já?** Ou queres outra ordem?
2. **Há tenants/dados reais em produção neste momento** que eu deva tratar com cuidado extra?
3. **Queres relatórios escritos** (markdown em `/mnt/documents`) ou só resposta no chat?
