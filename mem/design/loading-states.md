---
name: Loading states
description: When to use Skeleton vs InlineLoader vs Loader2 in buttons; banned patterns
type: design
---
# Loading States — Official Patterns

Use the right loader for the right context. Defined in `src/components/ui/loading-skeletons.tsx`.

## Decision matrix

| Context | Component | Why |
|---------|-----------|-----|
| Initial page load | `<PageSkeleton />` | Mimics layout, reduces perceived wait |
| Table loading | `<TableSkeleton columns rows />` | Preserves grid structure |
| KPI cards loading | `<KpiSkeleton count />` | Preserves card grid |
| Card list loading | `<CardListSkeleton count />` | Preserves list rhythm |
| Chart loading | `<ChartSkeleton />` | Avoids empty axis flash |
| Secondary area / refresh | `<InlineLoader />` | Spinner + "A carregar..." centered, py-8 |
| Inside button (submit/upload) | `<Loader2 className="h-4 w-4 animate-spin" />` | Replace icon while pending |
| Empty state (loaded, no data) | `<EmptyState icon title description action />` | Unified empty UI |
| Inline empty hint | `<EmptyHint>...</EmptyHint>` | Lightweight italic muted text |

## Banned patterns

- ❌ `<p>A carregar...</p>` solto — use `<InlineLoader />` instead.
- ❌ Custom `animate-spin rounded-full border-2` ad-hoc — use `<Loader2 />` (in buttons) or `<InlineLoader />` (standalone).
- ❌ Custom empty state divs — use `<EmptyState />`.

## Button submit pattern

```tsx
<Button disabled={mutation.isPending}>
  {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
  {mutation.isPending ? 'A guardar...' : 'Guardar'}
</Button>
```

## Page load pattern

```tsx
if (isLoading) return <AppLayout><PageSkeleton /></AppLayout>;
```