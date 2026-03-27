---
name: Fiscal management system
description: Business type (ENI/Empresa), regime, exemptions, team type, accountant config; conditional module visibility
type: feature
---

## Business Type (business_settings.business_type)
- 'eni': Empresário em Nome Individual
- 'empresa': Sociedade — always contabilidade_organizada, always has_accountant

## Team Type (business_settings.team_type)
- 'externa': only external contractors — no Ordenados page
- 'interna': only internal employees — Ordenados visible
- 'ambas': both — Ordenados visible

## Has Accountant (business_settings.has_accountant)
- Forced true when contabilidade_organizada
- When true + contabilidade_organizada: IVA/SS pages become informational guides (not hidden)

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

## Module Visibility Logic
- iva_exempt=true AND NOT contabilidade_organizada → IVA page hidden
- ss_exempt=true AND NOT contabilidade_organizada → SS page hidden
- contabilidade_organizada: IVA/SS pages SHOWN as informational guides
- team_type='externa' → Ordenados page hidden

## SS Type Logic
- independente: 21.4% on 70% of revenue (rendimento relevante)
- entidade_patronal: 23.75% employer + 11% employee on gross salaries
- ambos: both calculations shown

## Fiscal Deadlines (src/lib/fiscalDeadlines.ts)
- SS: day 20 of next month (if not exempt)
- IVA trimestral: last day of May/Aug/Nov/Feb+1
- IVA mensal: day 20 of next month
- IRS: June 30 of next year (if simplificado)
- Weekends/holidays → adjusted to previous business day (PT fixed holidays)

## Planned (not yet implemented)
- Bank statement upload (monthly, in Mensal section + stored in Documentos)
- Meta Ads report attachment on expense transactions
- Accountant export improvements (meta ads, bank statements, transactions with client data, PT/UE/fora UE location)
- Fiscal deadlines in daily digest emails
- Monthly fiscal obligations checklist in Mensal (SS paid, quarterly declaration, etc.)
