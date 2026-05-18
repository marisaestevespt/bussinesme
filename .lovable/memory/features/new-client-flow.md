---
name: New client flow
description: Lead → Cliente → Projeto → Portal são passos explícitos (sem cascata)
type: feature
---
Conversão Lead → Cliente cria APENAS o cliente + client_history (lead_id) + marca lead como ganho. Não cria projeto, portal, FAQs nem perguntas de diagnóstico.

Próximos passos são manuais na ficha do cliente:
- "Criar Projeto" (dialog existente em ClienteDetail) cria o projeto.
- "Ativar Portal" (botão em ClientPortalHealthBlock quando portal_active=false) cria portal + copia FAQs do produto + copia perguntas de diagnóstico.
- "Renovar / Novo Ciclo" continua a criar projeto + pagamentos + reativar portal (é um fluxo único intencional).

Motivo: evitar órfãos (cliente sem projeto, projeto sem portal, etc.) e dar controlo passo-a-passo ao utilizador.
