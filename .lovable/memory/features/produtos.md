---
name: Products
description: Product detail page structure, type options, and section organization
type: feature
---
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

## Tipo de Produto options
Consultoria Individual, Consultoria em Grupo, Mentoria Individual, Mentoria em Grupo, Curso Gravado, Workshop, Serviço Pontual, Serviço Mensal, Template, E-book

## Escada options
Lead Magnet, Qualificação, Produto de Entrada, Produto Intermédio, Produto Premium, Produto de Recorrência, Serviço

## Project types
Interno, Interno - Lançamento, Cliente - Projeto Único, Cliente - Serviço Mensal

## Portal type mapping
- servico_pontual, consultoria_*, mentoria_*, workshop, projeto_1_1 → projeto_unico portal
- servico_mensal → servico_mensal portal

## Auto-created SOPs on new product
When a product is created, 6 default SOPs are auto-inserted:
1. Entrada/Onboarding de Clientes
2. Gestão de Pagamentos
3. Recolha de NPS/Feedbacks
4. Acompanhamento de Cliente
5. KPIs de Produto
6. Fecho/Offboarding de Clientes
