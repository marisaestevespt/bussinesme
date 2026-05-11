# Fase 4 — Downloads centralizados + Auditoria + Qualidade

Última fase do plano de melhoria dos portais. Foco em centralizar tudo o que é descarregável, registar auditoria das ações do cliente, e dar à equipa um único sítio para verificar saúde do portal.

## 1. Downloads centralizados (cliente)

Nova secção **"Documentos"** no portal que agrega num só sítio:
- Contratos (de `clients.contract_documents`)
- Atas e materiais de reuniões (de `meetings.documents`)
- Anexos de entregas visíveis (de `phase_deliverables.attachments`)
- Ficheiros enviados em respostas a recolhas

Cada item mostra: nome, origem (contrato/reunião/entrega), data, botão **Descarregar**.

Implementação:
- Nova RPC `get_portal_all_documents(_token)` que une as 4 fontes
- Novo componente `PortalDownloadsSection.tsx`
- Adicionado ao `navItems` do `PortalView` entre "Contrato" e "Histórico"

## 2. Auditoria do portal

Tabela `audit_logs` já existe. Adicionar registo automático para 5 ações via triggers:
- `portal.session.created` (login do cliente — via novo RPC `portal_log_login`)
- `portal.request.created` (trigger em `client_requests`)
- `portal.meeting_prep.created` (trigger em `meeting_prep_items`)
- `portal.feedback.submitted` (trigger em `client_feedback`)
- `portal.document.downloaded` (RPC `portal_log_download` chamada do botão)

Frontend interno: novo `ClientPortalAuditBlock.tsx` na tab **Gestão** do `ClienteDetail`, mostra os últimos 20 eventos do portal deste cliente, ordenados por data.

## 3. Saúde do portal (qualidade)

Novo bloco `ClientPortalHealthBlock.tsx` no topo da tab **Portal** do `ClienteDetail`, com 6 indicadores:

| Indicador | Verde | Amarelo | Vermelho |
|---|---|---|---|
| Portal ativo | sim | — | não |
| Account Manager atribuído | sim | — | não |
| Último acesso | < 7 dias | 7–30 dias | > 30 dias ou nunca |
| Pedidos pendentes | 0 | 1–2 | ≥3 |
| Recolhas/feedback em atraso | 0 | 1 | ≥2 |
| Onboarding (perguntas iniciais) | 100% | 1–99% | 0% |

RPC `get_client_portal_health(_client_id)` calcula tudo server-side com `SECURITY DEFINER`.

## Detalhes técnicos

**Migração SQL** (uma só):
1. RPC `get_portal_all_documents(_token uuid)` — `SECURITY DEFINER`, valida portal ativo, retorna `jsonb[]` com `{name, url, source, source_label, created_at}`
2. RPC `portal_log_login(_token uuid)` — chamada após sucesso de OTP
3. RPC `portal_log_download(_token uuid, _file_name text, _source text)` — chamada do botão de download
4. Triggers `AFTER INSERT` em `client_requests`, `meeting_prep_items`, `client_feedback` que inserem em `audit_logs` com `entity_type='portal'`
5. RPC `get_client_portal_audit(_client_id uuid)` — admin only, retorna últimos 50 eventos
6. RPC `get_client_portal_health(_client_id uuid)` — admin only, retorna estrutura agregada

**Frontend**:
- `src/components/portal-view/PortalDownloadsSection.tsx` (novo)
- `src/components/clients/ClientPortalAuditBlock.tsx` (novo)
- `src/components/clients/ClientPortalHealthBlock.tsx` (novo)
- `src/pages/PortalView.tsx` (adicionar item nav + render + chamar `portal_log_login` no `init`)
- `src/pages/PortalAuth.tsx` (chamar `portal_log_login` após sucesso de OTP)
- `src/pages/ClienteDetail.tsx` (montar os 2 blocos novos nas tabs)

Sem mudanças destrutivas: tudo são novas RPCs, novo componente e triggers idempotentes. Os portais existentes continuam a funcionar exatamente como antes; ganham apenas a nova secção "Documentos" e auditoria silenciosa.
