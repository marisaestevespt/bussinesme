Design system constraints and project-wide rules.

## Tabs styling
- TabsList: no background (transparent, no bg-muted)
- TabsTrigger inactive: bg-background, border border-secondary, text-secondary-foreground
- TabsTrigger active: bg-primary, text-primary-foreground, border-primary, shadow-sm
- This applies globally via the shared tabs.tsx component — never override with custom grey/muted styles
