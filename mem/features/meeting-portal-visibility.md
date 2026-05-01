---
name: Meeting portal visibility flag
description: meetings.visible_in_portal — flag por reunião para controlar se aparece no portal do cliente
type: feature
---

## Schema
- `meetings.visible_in_portal boolean NOT NULL DEFAULT true`
- Default `true` — preserva comportamento legado (qualquer reunião com cliente associado aparece no portal).

## Lógica do portal
- A RPC `get_portal_meetings` filtra `AND m.visible_in_portal = true`.
- Para o cliente ver a reunião precisa de TODAS estas condições:
  1. `meetings.client_id = cliente` (ou legacy `client_name`)
  2. `client_portals.is_active = true`
  3. `client_portals.show_meetings = true`
  4. `meetings.visible_in_portal = true` ← novo

## UI
- **Form** (MeetingFormDialog em `src/pages/Reunioes.tsx`): toggle "Visível no portal do cliente" só aparece quando há `clientId`. Default ligado.
- **Detalhe** (`src/pages/ReuniaoDetail.tsx`): mesmo toggle, editável a qualquer altura. Só aparece se `m.client_id` existir.
- **Lista no projeto** (tab Fluxo de Trabalho): badge "🔒 Interna" nas reuniões com `client_id` mas `visible_in_portal=false`.

## Caso de uso
Ao criar reunião a partir de um projeto com cliente, todos os campos contextuais (client_id, project_id, etc.) são pré-preenchidos. Para fazer reunião interna sobre o cliente sem perder o link semântico, deslige-se o toggle — a reunião continua associada ao cliente/projeto internamente, mas o cliente não a vê no portal.
