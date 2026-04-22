---
name: Fiscal management system
description: Business type (ENI/Empresa), regime, exemptions, team type, accountant config; conditional module visibility; IVA exemption UX
type: feature
---

## Business Type (business_settings.business_type)
- 'eni': Empresário em Nome Individual
- 'empresa': Sociedade — always contabilidade_organizada, always has_accountant

## Team composition
No `team_type` field in UI — derived from existing `member_contracts`. The Ordenados/Prestadores pages are always available; rows populate from contracts. Column kept in DB for backward compat but unused.

## Has Accountant (business_settings.has_accountant)
- Single source of truth: `accountant_member_id IS NOT NULL`. The `has_accountant` column is still written (in sync as `!!accountant_member_id`) for backward compat with edge functions, but the UI no longer exposes a toggle.
- SettingsFiscal has ONE picker only: "Contabilista" → seleciona membro ou "Sem contabilista".
- The accountant is always a service provider (contrato_prestacao). No "internal/external" distinction — `accountant_type` column kept in DB but unused.
- When set + contabilidade_organizada: IVA/SS pages become informational guides (not hidden).

## ENI First Year Rules
- 1st year (<12 months from activity_start_date): auto-exempt IVA + SS (user can opt out)
- 2nd year+: still exempt IVA by default, SS becomes obligatory
- All configurable via toggles in Definições > Fiscal

## Fiscal Settings (business_settings)
- tax_iva_regime: 'isento' | 'trimestral' | 'mensal'
- tax_irs_regime: 'simplificado' | 'contabilidade_organizada'
- ss_type: 'independente' | 'entidade_patronal' | 'ambos'
- activity_start_date: DATE
- ss_exempt: BOOLEAN
- iva_exempt: BOOLEAN
- iva_exemption_end_date / ss_exemption_end_date: DATE — captured via dialog when user toggles exemption OFF; deadlines only count from this date onwards

## Module Visibility Logic
- iva_exempt=true AND NOT contabilidade_organizada → IVA page hidden
- ss_exempt=true AND NOT contabilidade_organizada → SS page hidden
- contabilidade_organizada: IVA/SS pages SHOWN as informational guides
- Ordenados/Prestadores pages: always available (filtered by existing contracts)

## Has Accountant — Behaviour
Tudo continua visível mesmo com contabilista (prazos SS/IVA, estimativas em previsibilidade, checklist mensal). A ÚNICA diferença é que **não se criam tarefas fiscais automaticamente** (nem no botão "Criar tarefa" assignment, nem no daily-status-update edge function), porque o contabilista gere isso internamente. As declarações em FinContabilidade aparecem atribuídas ao membro contabilista (em vez de Owner).

## Contract type lock
If a member is set as the accountant (`business_settings.accountant_member_id`), `useMemberSave` blocks changing their contract type away from `contrato_prestacao`. The MemberDialog header shows a "Contabilista" badge + explanatory note so the lock is visible up-front.

## SS Type Logic
- independente: 21.4% on 70% of revenue (rendimento relevante)
- entidade_patronal: 23.75% employer + 11% employee on gross salaries
- ambos: both calculations shown

## IVA Exemption UX (art. 53.º)
When iva_exempt=true:
- SaleFormDialog: hides IVA% and Fatura Total fields, shows only "Valor da Venda"; forces invoice_total = base_value
- FinSaidas (despesa form): hides IVA toggle/fields, shows only "Valor Total Pago"; forces base_value = total_with_vat (IVA paid is cost, not deductible)
- SettingsFiscal shows informative box explaining what changes

## Fiscal Deadlines (src/lib/fiscalDeadlines.ts)
- SS: day 20 of next month (if not exempt)
- IVA trimestral: last day of May/Aug/Nov/Feb+1
- IVA mensal: day 20 of next month
- IRS: June 30 of next year (if simplificado)
- Weekends/holidays → adjusted to previous business day (PT fixed holidays)
- Honors iva_exemption_end_date / ss_exemption_end_date: deadlines before that date are skipped

## Implemented
- Bank statement upload (monthly, in Mensal section + stored in financial_documents with doc_type=extrato_bancario)
- Meta Ads report attachment on expense transactions (stored in documents JSON with type=meta_ads) + monthly upload in Mensal
- Accountant export includes: client name/NIF, location (PT/UE/fora UE), department, bank statements, Meta Ads reports
- Fiscal deadlines in daily digest emails (prazos_fiscais section, shows overdue/next-15-days)
- Monthly fiscal obligations checklist in Mensal (fiscal_monthly_checks table: SS paid, quarterly declaration, IRS, bank statement)
- Business legal documents upload card (BusinessLegalDocs) on Tipo de Negócio
- NISS field on Identificação Fiscal card
- Owner notification on sale insert by non-owners (DB trigger `trg_notify_owners_on_sale_insert` on `commercial_sales`): notifies owners in the bell when the accountant (or any non-owner) registers a new invoice on a client. Skipped when author is themselves an owner. Type: `sale_added_by_accountant`.

## Planned (not yet implemented)
- Fiscal deadlines in daily digest emails for member digests (currently owner only)
