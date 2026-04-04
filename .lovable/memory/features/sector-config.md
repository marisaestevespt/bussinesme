---
name: Sector-based UI adaptation
description: business_sector field adapts terminology, module visibility, fields, workflows, and seed templates per industry
type: feature
---
- `business_sector` column on `business_settings` (default: `servicos_digitais`)
- 5 Sectors: servicos_digitais, saude_bem_estar, educacao_formacao, criativo_producao, consultoria_juridico
- Config in `src/lib/sector-config.ts`, hook in `src/hooks/useSectorConfig.tsx`
- `t(key)` translates generic terms (clientes→Pacientes for health, Projetos→Processos for legal, etc.)
- Sidebar uses termKey on NavItems to auto-translate labels
- Hidden modules per sector (e.g. tráfego pago hidden for health and legal)
- Sector selector in Settings > Identidade tab
- Sector-specific fields with `entity` property (business, client, product, project) — `getFieldsFor(entity)` method
- **Workflows** (`sector-config.ts`): pipelineStages, meetingTypes, suggestedRoutines per sector
- **Seed templates** (`src/lib/sector-templates.ts`): SOPs, financial categories, routines per sector
- **Template applier** (`src/components/settings/SectorTemplateApplier.tsx`): UI in Settings to preview and apply sector templates additively
- Templates insert into: sops, financial_categories, planning_routines
