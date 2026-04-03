## Plano: Reuniões recorrentes na ficha de cliente

### O que já funciona
- A página de Reuniões já tem lógica completa de recorrência (gerar ocorrências, `generateRecurrenceDates`)
- O portal do cliente já mostra reuniões + atas
- A tabela `meetings` já tem os campos necessários

### Alterações

**1. Substituir o dialog simples na ficha de cliente pelo `MeetingFormDialog` existente**
- Em vez de duplicar lógica, reutilizar o `MeetingFormDialog` de `Reunioes.tsx` que já tem:
  - Toggle de recorrência (semanal, quinzenal, mensal)
  - Data de fim da recorrência
  - Geração automática de todas as ocorrências + eventos de calendário
- Pré-preencher `client_id` e `client_name` automaticamente
- Se o cliente tiver `end_of_cycle`, sugerir essa data como `recurrence_end_date`

**2. Nenhuma alteração no portal necessária**
- O portal já mostra reuniões via `get_portal_meetings` que filtra por `client_id`
- As atas (discussion_points, final_notes, etc.) já são visíveis no portal

### Resultado
- Criar reunião recorrente na ficha de cliente → gera todas as ocorrências até fim do ciclo
- Cada reunião aparece automaticamente no portal
- Após atualizar a ata, fica visível no portal
