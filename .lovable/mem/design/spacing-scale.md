---
name: Spacing scale
description: Official spacing scale (gap, padding, margin, space-y) and which Tailwind values to use
type: design
---
# Spacing Scale (Tailwind 4px base)

Official scale — use ONLY these values for gap, p, m, space-y:

| Token | px  | Use for |
|-------|-----|---------|
| 0     | 0   | reset |
| 1     | 4   | inside chips/badges, tight icon+text |
| 2     | 8   | default gap & inner padding |
| 3     | 12  | compact card padding |
| 4     | 16  | standard card/section padding |
| 6     | 24  | spacing between sections |
| 8     | 32  | spacing between large blocks |
| 12    | 48  | hero / page header |
| 16    | 64  | extra large hero spacing |

**Banned (break 4px rhythm)**: 1.5, 2.5, 3.5, 5, 10, 14, 20

**Exception**: 0.5 is allowed for fine optical adjustments (mt-0.5 to nudge icons inline with text).

**Migration done (2026-04-25)**: gap-1.5/2.5/3.5 → gap-2/4, space-y-1.5/2.5 → space-y-2, p-10 → p-8, p-14 → p-16. Other outliers (p-5, py-2.5, p-2.5) kept — require visual review case-by-case.
