# 📊 Análise Panorâmica COMPLETA — Lyrata

> **Modo Plan** · Apenas leitura · 110 395 LOC · 215 tabelas · 22 edge functions · 376 migrações
> Escala: **P0 crítico** → **P1 alto** → **P2 médio** → **P3 baixo**

---

## 1. ARQUITETURA

**Stack**: Vite 5 + React 18 + TS 5 + Tailwind 3 + React Query 5 + Supabase (Lovable Cloud) + 70 deps. 65 rotas com `lazy()`. Estrutura por domínio: `pages/`, `components/{client,commercial,executive,financial,hr,marketing,product,project,planning,...}/`, `hooks/`, `lib/`, `integrations/supabase/`.

**Bem**
- `App.tsx` faz code-splitting agressivo (65 rotas `lazy`).
- Hooks bem nomeados por domínio (`useFinancialData`, `useCrmData`, `usePlanningData`).
- Camada `lib/` com utilitários puros isolados (`taskStatus`, `projectStatus`, `vatCalculations`, `payrollCalculations`).
- Refactor recente da `Secretaria.tsx` (1700→260 LOC) prova padrão repetível.
- Provider stack limpa em `App.tsx` (Auth, BusinessSettings, ActiveTimer, KpiSettings, Tabs, Dialogs).

**Mal/frágil**
- **Duplicação de listas de tarefas/responsabilidades**: `Secretaria` (`useMyTasks`), `Tarefas`, `HubEquipa`, `Projetos`, `Clientes`, `Reunioes` cada um com pequenas variantes de query → divergem facilmente. Há `useUnifiedResponsibilities` mas não é usado em todo lado.
- **Acoplamento Produtos↔Projetos↔Portal** via 4 triggers + 8 funções `sync_*` (ex: `sync_product_phase_to_projects`, `sync_product_deliverable_to_projects`, `sync_product_name_cascade`). Difícil debugar quando algo "atualiza sozinho".
- **Componentes-monstro**: 77 ficheiros >400 linhas. Top: `SopDetail` 1676, `GestaoMarca` 1664, `PortalView` 1616, `Operacao` 1427, `ProjetoDetail` 1265, `Tarefas` 1149, `ClienteDetail` 1094, `Agenda` 1080.
- **Sobreposição funcional** entre módulos: Operação vs Planeamento vs Capacidade vs Productivity; Hub Equipa vs ExecutiveGestaoEquipa; Secretária vs Hub. Fronteiras pouco claras.
- Sem `barrel index.ts` por pasta → imports longos e refactor caro.

**Risco: P1**
**Ação**: (a) extrair top-15 componentes >800 LOC em sub-componentes; (b) criar `hooks/useScopedTasks`, `useScopedMeetings` partilhados; (c) decision-doc curto para clarificar fronteiras Operação/Planeamento/Capacidade.

---

## 2. SEGURANÇA 🔴

**Bem**
- 100% das 210 tabelas públicas têm RLS ativada.
- `has_role()` SECURITY DEFINER bem implementada (sem recursão).
- Todas as 47 funções SECURITY DEFINER têm `set search_path = public` (verificado: 0 sem `search_path`).
- Zero referências a `service_role` no frontend.
- Zero secrets hardcoded em `src/`.
- Auth Lovable Cloud + Google + reset password + templates email já personalizados.

**Mal/frágil — CRÍTICO**
- **131 policies SELECT com `USING true`** — qualquer authenticated user vê tudo. Tabelas com PII/financeiro real:
  - `clients`, `client_contacts`, `crm_leads` → email, NIF, WhatsApp, telefone
  - `team_members` → IBAN, morada fiscal, settlement, hourly_cost
  - `business_setup` → NIF, NISS, IBAN, contabilista
  - `suppliers` → IBAN, NIF
  - `financial_contractors`, `financial_documents`, `financial_expenses` (via outras), `commercial_sales`, `business_legal_documents`, `member_contracts`, `financial_payroll`
- **Storage buckets PÚBLICOS** com listagem aberta: `custom-fonts`, `logos`, `personal-images`, `portal-uploads`. O `portal-uploads` aceita **INSERT anónimo** (qualquer um faz upload).
- **Forms críticos sem Zod**: `useForm` aparece **0 vezes**, `zod` aparece **1 vez**. Toda a validação de NIF/IBAN/email/datas é manual ou inexistente.
- **CORS `*` em 20/22 edge functions** — sem allow-list.
- Sem rate limiting visível em `manage-access-password`, `update-user-email`, `generate-invite-link`.
- `dangerouslySetInnerHTML` sanitizado com DOMPurify em `FloatingAiChat`, `CapacitySimulator`, `GestaoMarca` ✅, mas `ui/chart.tsx` não usa DOMPurify (CSS-only, OK).
- Extensão pgmq instalada em `public` (linter WARN).
- `business_settings` com **2 policies SELECT duplicadas** + 1 INSERT permissivo "Allow first setup insert".

**Risco: P0**
**Ação**:
1. Migration única que reescreve SELECT policies das 11 tabelas com PII/financeiro para `has_role(auth.uid(),'owner') OR has_role('admin') OR current_user_has_sensitive_access(...)`.
2. Trancar `portal-uploads`: INSERT só authenticated + validar token; tornar privado e servir via signed URL.
3. Buckets `personal-images`, `logos`, `custom-fonts`: avaliar tornar privados ou restringir SELECT por owner.
4. Adoptar Zod + `zodResolver` nos 8 forms mais críticos (cliente, fornecedor, despesa, venda, member, project, sale, expense).
5. Criar `_shared/cors.ts` com allow-list de origens (preview + custom domain).
6. Mover pgmq para schema dedicado.

---

## 3. PERFORMANCE

**Bem**
- 65 rotas + 86 chamadas `lazy()` total (componentes pesados).
- React Query: `staleTime: 30s`, `refetchOnWindowFocus: false` (sensato).
- 515 invalidações de query — bom controlo de cache.
- 364 indexes em 215 tabelas.
- `VirtualTable` existe (mas só 1 ficheiro a usar).
- `pdfjs-dist`, `tiptap`, `recharts`, `emoji-picker-react`, `@dnd-kit` carregados via lazy routes.

**Mal/frágil**
- **`xlsx` import**: nenhum (não está nas deps! exports usam `exportCsv.ts`). ✅
- **`recharts`**: importado direto em `CommercialOverview`, `CrmSummary`, `FinTrimestral`, `OverviewTab`, `TimeTab`, `Financeiro`, `ClientesAnalise`, `Operacao` — não lazy. **Bundle inicial pesado** quando entras em Secretária.
- **`pdfjs-dist 4.4.168`**: 70+ MB de worker; importado em 1 sítio mas vale verificar lazy.
- **`@tiptap`** (10 packages): importado em RichTextEditor (já lazy).
- `usePlanningData` 815 LOC — provavelmente over-fetching com vários `useQuery` aninhados.
- **N+1 latente**: 20+ FKs comuns SEM index (`client_contacts.client_id`, `meetings.project_id`, `commercial_sales.project_id`, `member_payments.member_id`, `performance_weekly.member_id`, …) → quando volume crescer, queries por `client_id`/`project_id` farão seq scan.
- Sem Service Worker / PWA, sem prefetch de rotas comuns.
- Imagens não otimizadas (sem `loading="lazy"` sistémico, sem `sizes`).

**Risco: P2**
**Ação**: (a) wrap dos charts com `React.lazy` num único `LazyChart` wrapper; (b) criar migração para indexar 20 FKs em falta; (c) auditoria de bundle (`vite-bundle-visualizer`); (d) `loading="lazy"` em `<img>` por convenção.

---

## 4. BUGS & LÓGICA

**Bem**
- 2 ocorrências `eslint-disable exhaustive-deps` apenas (baixo).
- Apenas 4 TODO/FIXME (baixo, e nem são reais).
- Helpers de status centralizados (`taskStatus.ts`, `projectStatus.ts`).

**Mal/frágil**
- **875 ocorrências `as any`** (418 em pages, 407 em components, 48 em hooks). Esconde drift entre Supabase types e UI.
- 107 `useEffect` ao todo — não auditados; risco de cleanup em falta.
- **Timezone**: 98 ocorrências de `toLocaleString/toLocaleDateString` sem `Europe/Lisbon` explícito. Cron `daily-status-update` corre em UTC; tarefas com `deadline` em date-only podem mudar de dia.
- 24 `console.log/error` ainda no código.
- 0 tests para `payrollCalculations`, `vatCalculations`, `salesCalculations`, `financialHealth`, `memberCapacity` (lógica de €).
- Triggers de cascade (`sync_product_name_cascade` actualiza 17 tabelas) — se uma falhar, restantes ficam inconsistentes (não está em transação explícita; está implicitamente, OK, mas sem teste regressão visível além do `test_product_rename_cascade`).
- `update_project_progress` usa `ROUND(_done/_total*100)` — divisão integer em PG é truncada se não casted — está OK porque `numeric` mas vale teste.

**Risco: P1**
**Ação**: criar `lib/dates.ts` com helpers Lisboa-aware; remover `as any` por domínio (começar `hooks/`); 5 ficheiros de teste para cálculos financeiros.

---

## 5. FLUXOS CRÍTICOS

**Bem**
- Auth/recovery: `resetPasswordForEmail` → `/reset-password` → `updateUser({password})` ✅ standard.
- Templates email customizados (Lyrata bordô) já em produção.
- `useConfirm` usado 30 vezes para ações destrutivas.
- Trigger `notify_owners_on_sale_insert` + notificações in-app a owners.

**Mal/frágil**
- **531 referências a delete/Trash2/onDelete no UI** mas só 30 confirms — proporção alta de deletes sem confirmação.
- **Projeto→Entregas→Tarefas**: agora desacoplado (botão "Aplicar entregas") — bom; mas o trigger `sync_product_deliverable_to_projects` em projetos antigos pode duplicar entregas se utilizador re-importar template.
- **Portal cliente**: `portal_email_allowed` aceita qualquer `team_members.email` — qualquer membro da equipa entra em qualquer portal. Confirma se é intencional.
- **Convite/onboarding**: `generate-invite-link` sem rate-limit.
- **Reuniões**: `auto_link_meeting_to_deliverable` pega na primeira deliverable `is_meeting=true && meeting_id is null` — se houver desordem de criação, liga à errada.
- `client_portals` aceita reset de senha apenas via OTP — falta lockout após N tentativas.
- `Hub de Equipa` com 13 referências a `usePermissions` apenas — provável que algumas páginas não cheguem a verificar.

**Risco: P1**
**Ação**: (a) wrap todos os deletes em `useConfirm`; (b) audit de `portal_email_allowed`; (c) rate-limit em invite/password endpoints; (d) adicionar `member_id` explícito ao trigger `auto_link_meeting_to_deliverable` (ou usar `meeting_link_hint` na criação).

---

## 6. CÓDIGO & QUALIDADE

**Bem**
- TypeScript estrito (sem `@ts-ignore` no projeto).
- ESLint configurado.
- Vitest + Playwright configurados (config files presentes).
- Skeletons (`InlineLoader`) e estados de loading consistentes.

**Mal/frágil**
- **Cobertura de testes: 9 ficheiros** para 344 componentes (~2.6%).
- **77 ficheiros >400 LOC**, 14 deles **>1000 LOC**.
- 875 `as any`.
- Zero `useForm` / 1 import de `zod` — toda a validação cliente é ad-hoc.
- Strings hardcoded PT-PT em todo o código (sem i18n) — OK se for intencional, mas dificulta white-label internacional.
- 4 TODO/FIXME (baixo).

**Risco: P1**
**Ação**: (a) introduzir Zod + react-hook-form como standard (3 forms piloto); (b) refactor dos 14 ficheiros >1000 LOC; (c) target 30% cobertura em `lib/`.

---

## 7. BASE DE DADOS

**Bem**
- 100% RLS, 364 indexes, 117 triggers.
- 47 funções SECURITY DEFINER **todas** com `set search_path = public` ✅.
- Inventário rico de RPCs de portal seguras (`get_portal_*`, `portal_*`).
- Dead-letter queue para emails (`move_to_dlq`).
- Triggers de validação em vez de CHECKs (boa prática).

**Mal/frágil**
- **Buckets públicos sem necessidade**: `portal-uploads` (DEVE ser privado), `personal-images`, `logos`, `custom-fonts`.
- **>40 FKs sem index** em colunas que entram em todos os filtros (lista parcial: `client_contacts.client_id`, `client_history.client_id`, `client_nps_records.*`, `commercial_sales.project_id`, `commercial_library_entries.project_id`, `meetings.{product_id,project_id}`, `meeting_participants.profile_id`, `member_payments.member_id`, `member_contracts.member_id`, `performance_{weekly,monthly}.member_id`, `financial_payroll.profile_id`, `crm_pipelines.project_id`, `content_items.{product_id,project_id}`, etc).
- pgmq extension em schema `public`.
- 376 migrações acumuladas (3 anos) — `reset-instance` raramente testado, risco de drift.
- Algumas funções (`backfill_deliverable_tasks`, `test_product_rename_cascade`) usam `INSERT/DELETE` sem checks de role — acessíveis via RPC a qualquer authenticated.
- `business_settings` permite 2 SELECT policies redundantes + INSERT "Allow first setup" sem revogar após primeiro uso.
- Colunas nullable em FKs sensíveis (ex: `tasks.assigned_to` nullable é desejado, mas `meetings.client_id` nullable + `client_name` text causa o split em `get_portal_meetings`).

**Risco: P1** (P0 para o bucket portal)
**Ação**: (a) migration com 40 indexes em FKs; (b) revogar EXECUTE em `backfill_*`/`test_*` para `authenticated`, restringir a `service_role`; (c) consolidar policies de `business_settings`.

---

## 8. PLANO DE AÇÃO — TOP 15

| # | Ação | Dim. | Risco | Esforço | Impacto |
|---|------|------|-------|---------|---------|
| 1 | Reescrever 11 SELECT policies expostas (clients, team_members, suppliers, business_setup, crm_leads, financial_*) para `has_role`/`current_user_has_sensitive_access` | Sec | **P0** | M | 🔥 |
| 2 | Privar bucket `portal-uploads` + INSERT só authenticated com validação de token | Sec | **P0** | S | 🔥 |
| 3 | CORS allow-list nas 20 edge functions (preview + custom domain + portal) | Sec | P1 | S | Alto |
| 4 | Rate-limit em `generate-invite-link`, `manage-access-password`, `update-user-email` (Deno KV ou tabela contadora) | Sec | P1 | M | Alto |
| 5 | Migration: 40 indexes em FKs (client_id, project_id, member_id, profile_id, product_id) em tabelas listadas | Perf/BD | P1 | S | Alto |
| 6 | Adoptar Zod + react-hook-form com `zodResolver` em 8 forms críticos (cliente, fornecedor, venda, despesa, member, project, lead, payment) | Sec/Bug | P1 | M | Alto |
| 7 | Refactor `SopDetail`, `GestaoMarca`, `PortalView`, `Operacao` (>1400 LOC) em sub-componentes | Arq | P1 | L | Médio |
| 8 | Wrap charts (`recharts`) em `LazyChart` para tirar do bundle inicial | Perf | P2 | S | Médio |
| 9 | Criar `lib/dates.ts` com `formatLisbon()`, substituir 98 calls de `toLocale*` | Bug | P1 | M | Alto |
| 10 | Eliminar 875 `as any` por domínio: começar `src/hooks/` (48) | Cód | P1 | L | Alto |
| 11 | Wrap todos os deletes (`Trash2` + `.delete()`) em `useConfirm` (auditar 531 vs 30) | UX/Fluxo | P1 | M | Alto |
| 12 | Testes unitários para `payrollCalculations`, `vatCalculations`, `salesCalculations`, `financialHealth`, `memberCapacity` | Cód | P1 | M | Alto |
| 13 | Mover extensão `pgmq` de `public` para schema próprio | BD/Sec | P2 | S | Baixo |
| 14 | Revogar EXECUTE em `backfill_deliverable_tasks` e `test_product_rename_cascade` para role `authenticated` | BD/Sec | P2 | S | Médio |
| 15 | Documentar fronteiras Operação ↔ Planeamento ↔ Capacidade ↔ Productivity (decision-doc) e consolidar duplicação | Arq/Prod | P2 | M | Médio |

---

## Resumo executivo

- **Forças**: stack moderna e consistente; 100% RLS; auth completo; lazy routes; tokens HSL white-label; refactors recentes mostram bom caminho (Secretaria, decoupling de entregas).
- **Riscos P0 (resolver já)**: PII e dados financeiros legíveis por *qualquer* utilizador autenticado (11 tabelas) + bucket `portal-uploads` aceita uploads anónimos.
- **Riscos P1 (próximas semanas)**: ausência de validação Zod, CORS aberto, falta de rate-limit, 40 FKs sem index, ficheiros monstro, 875 `as any`, baixa cobertura de testes.
- **Riscos P2/P3**: extensão em public, pgmq, charts no bundle inicial, fronteiras de módulos.

---

## Como avançar

Posso, em modo build, executar qualquer item isoladamente ou em pacote. Recomendação:

1. **Pacote Segurança P0** (#1, #2) — uma migração + ajuste do bucket. <30 min, impacto máximo.
2. **Pacote Performance/BD** (#5, #13, #14) — uma migração só de indexes/policies. Baixo risco, ganho imediato.
3. **Pacote Endurecimento Edge** (#3, #4) — `_shared/cors.ts` + tabela `rate_limits`.
4. Depois: refactors progressivos (#6, #7, #9, #10, #11, #12).

Diz-me por onde queres arrancar.
