## Assistente IA Lirah — Plano de Implementação

### 1. Edge Function `ai-assistant`
- Recebe mensagens do utilizador + histórico da conversa
- System prompt contextualizado com o negócio do utilizador
- **Tools disponíveis para a IA:**
  - `query_clients` — pesquisar/contar clientes, ver detalhes
  - `query_tasks` — listar tarefas pendentes, atrasadas, por responsável
  - `query_financials` — resumo financeiro, entradas/saídas do mês
  - `query_sales` — vendas do período, pipeline CRM
  - `create_task` — criar uma tarefa (com confirmação do utilizador)
  - `query_meetings` — próximas reuniões, agenda
  - `query_team` — informações da equipa, carga de trabalho
- Streaming SSE para respostas em tempo real
- Tratamento de erros 429/402

### 2. Componente `FloatingAiChat`
- Botão flutuante no canto inferior direito (chat bubble)
- Painel de chat que abre/fecha com animação suave
- Renderização markdown das respostas
- Streaming token-by-token
- Histórico da conversa na sessão
- Indicador de "a pensar..." / "a executar ação..."
- Quando a IA quer executar uma ação, mostra confirmação ao utilizador

### 3. Integração no AppLayout
- Adicionar o FloatingAiChat ao layout principal
- Disponível em todas as páginas para utilizadores autenticados

### 4. Persistência (opcional, fase 2)
- Guardar conversas na base de dados para histórico
- Sugestões proativas baseadas em dados (notificações do assistente)