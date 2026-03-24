Product detail page structure and section organization

## Main page (no tabs)
- Cover image
- Logo + Name + Short Description
- Properties card: Status, Tipo de Produto, Escada, Tipo de Vendas, Ticket €, Horas mensais, Tempo de Acesso (cycle_duration days), Página de Vendas (link)
- Content card: Sobre o Produto, O que está incluído, FAQs
- Datas Importantes card (bg-background border-secondary): events from `events` table where product_name matches
- Feedbacks card

## Section buttons (toggle open/close, not tabs)
- Comercial: Cliente do Produto, Ações de Venda, Produtos Concorrentes
- Marketing: Conteúdos (via product_id FK on content_items), Funis, Automações, Tráfego Pago
- Contabilidade: Dados de Faturação, Calculadora de Oferta (includes Custos do Produto)
- Processos: SOPs table (from sops table, linked_entity_type=produto), Template de Projeto
- Backoffice: Links Úteis, Drive, Melhorias
- Customer Success: ProductCustomerSuccess component (NPS history only)
- Métricas: ProductMetricsTab (gallery of months with year nav)
- Arquivo: Brainstorming

## content_items.product_id
- Added product_id (uuid FK → products) to content_items table
- ConteudoDetail uses Select dropdown to pick product (sets both product_id and product_name)
- ProdutoDetail Marketing section queries content_items by product_id

## Auto-created SOPs on new product
When a product is created, 6 default SOPs are auto-inserted:
1. Entrada/Onboarding de Clientes
2. Gestão de Pagamentos
3. Recolha de NPS/Feedbacks
4. Acompanhamento de Cliente
5. KPIs de Produto
6. Fecho/Offboarding de Clientes

## SOP-specific embedded UIs (inside SOP detail page)
- Onboarding SOP → Template de Onboarding table (product_onboarding_templates)
- Offboarding SOP → Template de Offboarding table + Antecedência de Renovação
- Pagamentos SOP → Formas de Pagamento checkboxes
- NPS/Feedbacks SOP → NPS config (cadence, responsible, message, form URL)
- Acompanhamento SOP → Marcos de Acompanhamento table (product_milestones)
- KPIs SOP → KPIs config (create/toggle/delete KPIs with type, source, goals)

## Removed/moved
- Standalone "Processos" card from main page → Processos section
- Standalone Onboarding/Offboarding cards → inside SOP detail
- KPIs do Produto tab → inside KPIs de Produto SOP
- Custos do Produto standalone card → merged into Calculadora de Oferta
- Antecedência de Renovação → inside Offboarding SOP
- Tabs UI replaced by toggle buttons that expand sections below
- "Comercial & Mkt" split into separate "Comercial" and "Marketing" sections
- Cliente do Produto moved from Backoffice to Comercial
