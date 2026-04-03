---
name: AI Assistant (Lirah AI)
description: Floating chat assistant with DB tools for querying clients, tasks, financials, sales, meetings, team, projects, and creating tasks
type: feature
---
## AI Assistant — Lirah AI

- Edge function: `ai-assistant` (non-streaming, tool-calling loop)
- Model: google/gemini-2.5-flash
- UI: FloatingAiChat component, floating bubble bottom-right
- Available tools: query_clients, query_tasks, query_financials, query_sales, query_meetings, query_team, create_task, query_projects
- System prompt includes business name from business_settings
- Uses LOVABLE_API_KEY (auto-provisioned)
- Integrated in AppLayout for all authenticated pages
