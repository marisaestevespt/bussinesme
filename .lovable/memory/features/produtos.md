Product detail page layout (reorganized)

## Main page (no "Produto" tab)
- Cover image
- Logo + Name + Short Description
- Properties card: Status, Tipo de Produto, Escada, Tipo de Vendas, Ticket €, Horas mensais, Tempo de Acesso (cycle_duration days), Página de Vendas (link)
- Content card: Sobre o Produto, O que está incluído, FAQs
- Datas Importantes card (bg-background border-secondary): events from `events` table where product_name matches — table: evento, data/hora, status (Hoje/Futuro/Passado)
- Feedbacks card
- Processos (LinkedSopsSection)

## Section buttons (toggle open/close, not tabs)
- Comercial & Mkt: Ações de Venda, Funis, Automações, Concorrentes, Tráfego Pago
- Contabilidade: Dados de Faturação, Calculadora de Oferta
- Backoffice: Cliente do Produto (moved here), Links Úteis, Drive, Templates (Onboarding/Offboarding/Projeto), Melhorias, Custos
- Customer Success: ProductCustomerSuccess component
- KPIs do Produto: ProductKPIsTab component
- Métricas: ProductMetricsTab (gallery of months with year nav)
- Arquivo: Brainstorming

## Removed
- "Vendas feitas" section (charts) — eliminated
- "Produto" tab — content redistributed to main page
- Tabs UI replaced by toggle buttons that expand sections below
