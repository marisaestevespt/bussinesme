
## Importação Automática de Métricas de Redes Sociais

### Como funciona
Uma edge function corre periodicamente (1x por dia ou sob pedido manual) e puxa métricas das APIs oficiais de cada rede social, guardando na tabela `channel_monthly_metrics` que já existe.

### Plataformas suportadas (por ordem de viabilidade)
1. **Instagram / Facebook** — Meta Graph API (requer Facebook App + token de longa duração)
2. **YouTube** — YouTube Data API v3 (requer Google API Key)
3. **TikTok, LinkedIn, Pinterest** — APIs mais restritivas, implementação futura

### Passos de implementação

1. **UI de configuração** — Nova secção em Definições > Marketing para o utilizador colar os tokens de acesso de cada plataforma (guardados como secrets seguros)
2. **Edge function `fetch-social-metrics`** — Chama as APIs oficiais, processa os dados e insere/atualiza na tabela `channel_monthly_metrics`
3. **Botão "Atualizar métricas"** — Na página de análise de cada canal, para puxar dados a pedido
4. **Cron job diário** (opcional) — Para atualizar automaticamente todos os dias

### Pré-requisitos do utilizador
- **Instagram/Facebook**: Criar uma Facebook App (gratuita), gerar um Page Access Token de longa duração
- **YouTube**: Criar uma API Key no Google Cloud Console (gratuita até 10.000 requests/dia)

### O que será importado
- **Instagram**: seguidores, impressões, alcance, engagement, visitas ao perfil, cliques na bio
- **YouTube**: visualizações, horas assistidas, novos subscritores
- **Outros**: métricas específicas conforme disponibilidade da API
