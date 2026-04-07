## Sistema de Abas Internas

### Conceito
Barra de abas entre o header e o conteúdo principal, similar a um browser. Cada aba corresponde a uma página diferente do sistema. Máximo 10 abas.

### Arquitetura

1. **TabsContext** — Estado global com:
   - Lista de abas abertas (rota, título, ícone)
   - Aba ativa
   - Funções: abrir, fechar, alternar, reordenar
   - Persistência em `localStorage` para manter abas entre sessões

2. **TabsBar** — Componente visual:
   - Barra com scroll horizontal quando há muitas abas
   - Cada aba mostra ícone + título da página + botão ✕ para fechar
   - Aba ativa destacada com cor primary
   - Botão **+** à direita para abrir nova aba (abre a página atual como referência ou um menu rápido)
   - Botão para fechar todas exceto a ativa

3. **Integração com Router**:
   - Ao navegar normalmente, a aba ativa muda de rota (comportamento normal)
   - Ao clicar no **+**, abre uma nova aba com a rota da Secretaria (homepage) ou com um picker
   - Cada aba mantém a sua rota independente
   - Ao clicar numa aba, navega para a rota dessa aba
   - Dados ficam sincronizados via React Query (cache partilhado entre abas)

4. **Posição no layout**:
   - Inserida no `AppLayout`, entre o header e o `<main>`
   - Só aparece quando há 2+ abas abertas (com 1 aba fica escondida para não poluir)

### O que NÃO muda
- Sidebar, header, notificações — tudo igual
- React Query continua a funcionar normalmente (cache partilhado = dados sempre atualizados)
- Portal do cliente não é afetado

### Limitações conhecidas
- Cada aba partilha a mesma sessão (é o mesmo browser, não são iframes)
- O histórico do browser (back/forward) funciona apenas para a aba ativa
