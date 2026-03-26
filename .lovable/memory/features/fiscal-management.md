---
name: Fiscal management system
description: Fiscal settings, automatic module visibility, deadline tracking with task auto-creation, accountant export
type: feature
---

## Fiscal Settings (business_settings)
- tax_iva_regime: 'isento' | 'trimestral' | 'mensal'
- tax_irs_regime: 'simplificado' | 'contabilidade_organizada'
- activity_start_date: DATE
- ss_exempt: BOOLEAN
- iva_exempt: BOOLEAN

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
