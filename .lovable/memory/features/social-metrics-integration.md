---
name: Social Metrics Integration
description: Auto-import metrics from Instagram/YouTube/Facebook APIs via edge function and stored tokens
type: feature
---
- Table `channel_social_tokens` stores API tokens per marketing channel (1:1 with marketing_channels)
- Edge function `fetch-social-metrics` calls Meta Graph API (Instagram/Facebook) and YouTube Data API v3
- Metrics stored in existing `channel_monthly_metrics` table
- Settings UI in Definições > Marketing > "Integração com Redes Sociais"
- "Importar métricas" button on ChannelMonthlyAnalysis page header
- Supported: Instagram (Page Token + ig_user_id), YouTube (API Key + channel_id), Facebook (Page Token + page_id)
- Future: TikTok, LinkedIn, Pinterest when APIs allow
