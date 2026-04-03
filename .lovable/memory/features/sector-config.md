---
name: Sector-based UI adaptation
description: business_sector field adapts terminology, module visibility, and fields per industry
type: feature
---
- `business_sector` column on `business_settings` (default: `servicos_digitais`)
- Sectors: servicos_digitais, saude_bem_estar, educacao_formacao, criativo_producao
- Config in `src/lib/sector-config.ts`, hook in `src/hooks/useSectorConfig.tsx`
- `t(key)` translates generic terms (clientes→Pacientes for health, etc.)
- Sidebar uses termKey on NavItems to auto-translate labels
- Hidden modules per sector (e.g. tráfego pago hidden for health)
- Sector selector in Settings > Identidade tab
- Sector-specific fields defined per sector (cedula profissional for health, etc.)
