---
name: Fiscal management system
description: Fiscal settings with SS type (independente/patronal/ambos), automatic module visibility, deadline tracking, accountant export
type: feature
---

## Fiscal Settings (business_settings)
- tax_iva_regime: 'isento' | 'trimestral' | 'mensal'
- tax_irs_regime: 'simplificado' | 'contabilidade_organizada'
- ss_type: 'independente' | 'entidade_patronal' | 'ambos'
- activity_start_date: DATE
- ss_exempt: BOOLEAN
- iva_exempt: BOOLEAN

## SS Type Logic
- independente: 21.4% on 70% of revenue (rendimento relevante), based on quarterly declaration
- entidade_patronal: 23.75% employer + 11% employee on gross salaries (contrato trabalho)
- ambos: both calculations shown in tabs

## SS Independente Calculation
- Revenue of quarter × 70% = Rendimento Relevante
- Rendimento Relevante ÷ 3 = Base Mensal
- Base Mensal × 21.4% = Contribuição
- Minimum: €20/month, Maximum: €1,379.35/month
- Exempt first 12 months of activity
- Payment: day 10-20 of each month
- Quarterly declaration deadlines: Apr 30, Jul 31, Oct 31, Jan 31

## Module Activation Logic
- iva_exempt=true OR contabilidade_organizada → IVA page hidden from Financeiro
- ss_exempt=true OR contabilidade_organizada → SS page hidden from Financeiro
- Settings tab "Fiscal" allows manual toggle of exemptions

## Fiscal Deadlines (src/lib/fiscalDeadlines.ts)
- SS: day 20 of next month (if not exempt)
- IVA trimestral: last day of May/Aug/Nov/Feb+1 (if trimestral regime)
- IVA mensal: day 20 of next month (if mensal regime)
- IRS: June 30 of next year (if simplificado)
- Weekends/holidays → adjusted to previous business day (PT fixed holidays)

## Auto Task Creation (daily-status-update)
- Creates fiscal tasks 30 days before each deadline
- Priority: alta, department: contabilidade, tag: Fiscal
- Deduplication by task name

## Accountant Export (FinContabilidade)
- Period selector: month/quarter/year/custom
- Exports CSV (Excel-compatible) and PDF
- Content: summary, entries, expenses, documents

## Previsibilidade Financeira
- Includes tax forecast column (SS + IVA) per month
- SS calculation adapts to ss_type setting
- Shows breakdown label (SS Ind. + SS Pat. + IVA)
