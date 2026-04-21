---
name: UI Identity - Marsala / Bordô
description: Lyrata identity uses warm marsala/bordô primary (hsl 351 56% 28%), salmon accents, cream backgrounds (hsl 33 43% 96%), warm-tinted shadows, Sora display + Inter body. Sidebar is deep bordô. Status badges use unified StatusBadge component with semantic tones (success/warning/destructive/info/primary/muted) — never hardcoded Tailwind colors.
type: design
---

## Palette (Light)
- Background: warm cream `hsl(33 43% 96%)`
- Card: pure white `hsl(0 0% 100%)`
- Primary: marsala/bordô `hsl(351 56% 28%)` — THE signature color
- Accent: soft salmon `hsl(3 42% 94%)` with marsala foreground
- Secondary: warm sand `hsl(33 30% 93%)`
- Foreground: dark `hsl(0 0% 16%)`

## Semantic tones (always use these — never hardcoded colors)
- success / warning / destructive / info — defined in index.css, exposed via Tailwind
- chart-1 → chart-5: brand-derived palette for Recharts

## Identity Principles
- Marsala/bordô is the signature — primary actions, focus rings, sidebar accents
- Salmon as soft accent for highlights and hover states
- Cream backgrounds, never pure off-grey
- Rounded-xl cards, warm-tinted shadows (rgba marsala)
- Generous whitespace, subtle elevation
- Sora display headings, Inter body

## Sidebar
- Background: deep bordô `hsl(350 30% 11%)`
- Active items: bg-sidebar-accent with sidebar-primary-foreground
- Hover: bg-sidebar-accent/60

## Component conventions
- Status badges: use `<StatusBadge tone="success|warning|...">` from `@/components/ui/status-badge`
- Cards: `.hq-card` utility for consistent elevation + hover
- Never use raw Tailwind palette colors (bg-amber-100, text-emerald-600, etc.) — always semantic tokens
