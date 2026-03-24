Product detail page layout (reorganized)

## Main page (no "Produto" tab)
- Cover image
- Logo + Name + Short Description
- Properties card: Status, Tipo de Produto, Escada, Tipo de Vendas, Ticket €, Horas mensais, Tempo de Acesso (cycle_duration days), Página de Vendas (link)
- Content card: Sobre o Produto, O que está incluído, FAQs
- Datas Importantes card (bg-background border-secondary): events from `events` table where product_name matches — table: evento, data/hora, status (Hoje/Futuro/Passado)
- Feedbacks card

## Section buttons (toggle open/close, not tabs)
- Comercial & Mkt: Ações de Venda, Funis, Automações, Concorrentes, Tráfego Pago
- Contabilidade: Dados de Faturação, Calculadora de Oferta
- Processos: SOPs table (from sops table, linked_entity_type=produto), Formas de Pagamento, SOP Onboarding template, SOP Offboarding template, Template de Projeto
- Backoffice: Cliente do Produto, Links Úteis, Drive, Melhorias, Custos
- Customer Success: ProductCustomerSuccess component
- KPIs do Produto: ProductKPIsTab component
- Métricas: ProductMetricsTab (gallery of months with year nav)
- Arquivo: Brainstorming

## Auto-created SOPs on new product
When a product is created, 4 default SOPs are auto-inserted:
1. Entrada/Onboarding de Clientes
2. Gestão de Pagamentos
3. Recolha de NPS/Feedbacks
4. Fecho/Offboarding de Clientes

## Removed
- Standalone "Processos" card from main page — moved to Processos section
- "Template de Onboarding/Offboarding" renamed to "SOP: Entrada/Onboarding" and "SOP: Fecho/Offboarding"
- "Vendas feitas" section (charts) — eliminated
- Tabs UI replaced by toggle buttons that expand sections below
