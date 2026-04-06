---
name: Product Diagnostic Questions
description: Diagnostic questions stored per product, auto-imported into client portal on portal creation
type: feature
---
## product_diagnostic_questions table
- product_id, question_group, question, internal_note, answer_type, sort_order
- Groups: O Negócio, Equipa, Operação e Processos, Ferramentas Atuais, Dificuldades e Visão, Config. Sistema (8 sub-groups)

## Flow
1. Questions are defined in product detail → Processos section → "Perguntas de Diagnóstico"
2. When portal is created for a client, questions are auto-seeded into portal_initial_questions
3. Questions can also be manually imported via "Importar do Produto" button in portal section
4. Additional questions can be added per-project/portal

## Components
- src/components/product/ProductDiagnosticQuestions.tsx — CRUD UI for product-level questions
- src/components/client/ClientPortalSection.tsx — seedQuestionsFromProduct() on portal creation
