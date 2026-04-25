---
name: Empty states
description: Unified empty state components — when to use EmptyState vs EmptyHint
type: design
---
# Empty States — Official Patterns

Two components, defined in `src/components/ui/loading-skeletons.tsx`.

## EmptyState — primary empty UI

Use when an entire page, tab, or main section has no data. Provides icon + title + description + CTA.

```tsx
<EmptyState
  icon={Inbox}
  title="Sem clientes ainda"
  description="Cria o primeiro cliente para começar."
  action={<Button onClick={createClient}>Criar cliente</Button>}
/>
```

## EmptyHint — inline lightweight empty

Use inside cards, sub-lists, or secondary panels. One-line italic muted text.

```tsx
<EmptyHint>Sem reuniões associadas</EmptyHint>
```

## Banned patterns

- ❌ `<p className="text-muted-foreground text-center py-8">Sem X</p>` — use `<EmptyHint>`
- ❌ Custom div com ícone + texto centrado para empty principal — use `<EmptyState>`

## Microcopy

- Use "Sem X" (preferido) ou "Nenhum X" — nunca "Não há X registados".
- Keep it short. If there's a primary action, add it as `action` prop on `EmptyState`.
- Tone: PT-PT, "tu", informal-profissional (ver `mem://design/microcopy`).