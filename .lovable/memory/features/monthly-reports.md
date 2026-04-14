---
name: Monthly report system
description: Automated monthly reports compiling data from all modules, stored as JSON in storage, with Executive Room UI
type: feature
---
- Edge function `generate-monthly-report` compiles data from: financial, commercial, clients, tasks, meetings, team hours, CRM, deliverables
- `monthly_reports` table tracks history (year, month, status, report_data JSON, file_path)
- `monthly-reports` private storage bucket for JSON files
- Cron job `generate-monthly-report` runs on 2nd of each month at 06:00 UTC
- UI in Executive Room dashboard (MonthlyReportSection) below navigation cards
- Manual trigger with month selector + "Gerar" button
- Report viewer with KPI cards, progress bars, CRM stats, team stats, top products
- Notifies owner(s) on completion
- Cron calls use anon key (skip owner check); manual calls require owner JWT
