---
name: Automated backup system
description: Weekly automated backups of all data to storage, with manual trigger and history UI in Definições
type: feature
---
- Edge function `run-backup` exports all tables to JSON and uploads to `backups` storage bucket
- `backups` table tracks history (status, size, tables count, trigger type)
- Cron job `weekly-backup` runs every Sunday at 03:00 UTC
- Owner-only manual trigger via Definições → Backups tab
- Download via signed URL from private storage bucket
