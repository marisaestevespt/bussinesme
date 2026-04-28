---
name: Renewal vs One-off project alerts
description: Cron split — recurring services use altura_renovacao flow; one-off projects get end-of-project alerts (5 business days + 1 day before)
type: feature
---

## Recurring services (servico_mensal / sales_type=avenca_mensal)
- `check-renewal-status` cron flips client status `ativo` → `altura_renovacao` when end_of_cycle is within product.renewal_advance_days.
- Creates renewal task + notifications to all owners.
- IGNORES one-off products entirely.

## One-off projects (everything else, e.g. consultoria_individual)
- `check-project-ending` cron (daily 08:30 UTC) checks active clients with one-off products.
- 5 business days before end_of_cycle → task "Acompanhamento final — {client}" + notification (type: fim_projeto).
- 1 calendar day before end_of_cycle → task "Mensagem de despedida — {client}" + notification.
- Does NOT change client.status (stays ativo until owner acts).

## Detection
- Product is recurring iff `product_type = 'servico_mensal'` OR `sales_type = 'avenca_mensal'`.
- Without product metadata: treated as NOT recurring (safer to skip than wrong-flag).
