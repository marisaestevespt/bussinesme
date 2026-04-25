---
name: Collection / Gallery pattern
description: Canonical layout kit for any list/gallery/board page (Reuniões, Clientes, Projetos, Vendas, Marketing, etc.). Lives in src/components/layout/collection.
type: design
---
Every collection page (gallery, list, board, table of entities) MUST compose
the canonical kit in `src/components/layout/collection`:

- `<CollectionPage>` — page wrapper (max-w-7xl, vertical rhythm).
- `<CollectionHeader title icon count actions />` — large title + count chip + right-aligned `+ New` button. No custom PageHeader on collection routes.
- `<CollectionToolbar search onSearchChange trailing>{filterChips}</CollectionToolbar>` — search left, filter chips middle, view switcher right.
- `<CollectionViewSwitcher value onChange views={['grid','list','board','calendar']} />` — pill-style segmented control. Use only the views that page actually supports.
- `<CollectionGrid density="comfortable">` — 2/3/4-up responsive grid for cards.
- `<CollectionCard title description icon eyebrow status meta cover onClick />` — slot-based card. Do NOT compose ad-hoc card layouts.
- `<CollectionEmpty icon title description action />` — soft dashed empty state. Tone: see mem://design/empty-states.

Rules:
- Never reach for raw `Card` + custom flex header on a gallery page — use `CollectionCard`.
- Never write a custom search input + filter row — use `CollectionToolbar`.
- Tabs on a collection page (e.g. status segments) MUST use the same pill style as `EntityTabs` (`rounded-full bg-muted/50 p-1`).
- Detail pages keep using `EntityHero/Title/TopBar/Properties/Tabs/Section` (mem://design/ui-redesign).