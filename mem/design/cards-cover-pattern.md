---
name: cards-cover-pattern
description: Padrão sóbrio para cards/galerias com capa: fallback minimalista (ícone Lucide + título sobre superfície neutra) e botão de upload de capa por hover para Owner, guardando em bucket público dedicado com cover_url na tabela
type: design
---
# Padrão de capas para galerias de cards

Aplicado em: Processos (departamentos + SOPs), Estratégia por Canal (Marketing).

## Regras
1. **NUNCA** usar imagens hardcoded (`@/assets/...`) com gradiente preto + texto branco como capa principal de cards de entidades editáveis pelo utilizador.
2. **Fallback sóbrio:** se não houver `cover_url`, mostrar:
   - Superfície neutra (`hq-surface-sunken` ou `bg-card`).
   - Ícone Lucide pequeno (`h-6 w-6 text-muted-foreground/70`) representando a entidade.
   - Título em `text-sm font-medium text-foreground`.
3. **Capa real:** se houver `cover_url`, `<img object-cover>` com gradiente subtil `from-background/90` (NÃO preto) para o título permanecer legível em `text-foreground`.
4. **Upload (Owner):** botão `<Upload>` em `absolute top-1.5 right-1.5` que aparece em `group-hover`, com input file escondido. Bucket dedicado público (`channel-covers`, `process-covers`, etc.) com policy de leitura pública e escrita só Owner.
5. **Coluna DB:** sempre `cover_url text` (nullable) na tabela da entidade.

## Why
O utilizador pediu repetidamente capas mais sóbrias e upload interno em galerias (Processos, depois Estratégia por Canal). Cada vez que se cria uma nova galeria, deve seguir este padrão por defeito em vez de repetir o erro de imagens hardcoded + overlay preto.

## How to apply
- **Marketing channels:** usar SEMPRE `<ChannelCard>` de `@/components/marketing/ChannelCard`. NUNCA recriar cards de canal à mão (acontecia em MarketingDashboard "Canais" e MarketingEstrategia "Estratégia por Canal" — ambos consolidados neste componente). Bucket: `channel-covers`. Coluna: `marketing_channels.cover_url`.
- **Outras entidades (processos, etc.):** seguir o mesmo padrão — fallback Lucide, capa upload, overlay de upload por hover. Para novos buckets seguir o template de 4 policies (SELECT público, INSERT/UPDATE/DELETE Owner only).
- Antes de criar uma listagem nova de canais/processos/departamentos, PROCURAR um componente partilhado existente (`ChannelCard`, `ProcessCover`, etc.) e reutilizá-lo em vez de duplicar código.
