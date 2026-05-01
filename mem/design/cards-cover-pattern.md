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
- Reutilizar a estrutura do `MarketingEstrategia.tsx` (secção "Estratégia por Canal") como referência: `CHANNEL_ICON` map + render condicional `cover ? <img/> : <fallback/>` + overlay de upload.
- Para novos buckets seguir o template de policies em `supabase/migrations/...170530...sql` (4 policies: SELECT público, INSERT/UPDATE/DELETE Owner only).
