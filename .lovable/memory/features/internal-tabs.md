---
name: Internal tab system
description: Browser-like tab bar for navigating multiple pages simultaneously within the app
type: feature
---
- AppTabsProvider in useAppTabs.tsx manages tab state (max 10 tabs)
- TabsBar component renders between header and main content in AppLayout
- Tabs persist in localStorage
- Bar only visible when 2+ tabs are open
- "+" button opens dropdown with quick-access pages
- React Query cache is shared across tabs (data stays in sync)
- Portal routes are excluded from the tab system
