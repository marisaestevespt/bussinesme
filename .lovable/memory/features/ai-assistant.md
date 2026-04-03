---
name: AI Assistant (Lirah AI)
description: Floating chat assistant with generic DB query tools — can access ANY table in the system
type: feature
---
## AI Assistant — Lirah AI

- Edge function: `ai-assistant` (non-streaming, tool-calling loop, max 8 iterations)
- Model: google/gemini-2.5-flash
- UI: FloatingAiChat component, floating bubble bottom-right
- Available tools: query_table (generic, any table), list_tables (schema discovery), create_task
- System prompt includes business name, user name (from profiles), and table reference guide
- Uses LOVABLE_API_KEY (auto-provisioned)
- Integrated in AppLayout for all authenticated pages
- Blocked tables: audit_logs, member_sensitive_access, backups
