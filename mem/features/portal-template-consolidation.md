---
name: Portal template consolidation
description: Portal Template tab eliminada; FAQs unificadas em products.faqs com trigger que propaga aos portais
type: feature
---
- Tab "Portal Template" removida do ProdutoDetail. ProductWelcomeEmailSection movida para tab Branding.
- Colunas dropadas em products: portal_faqs_template, portal_materials_template, portal_timeline_template (todas eram redundantes/órfãs).
- FAQs do portal: única fonte = products.faqs (label "FAQs do Portal do Cliente" na tab Geral).
- Trigger sync_portal_faqs_from_product + portal_after_insert_faqs popula portal_faqs (from_template=true) ao criar portal.
- Trigger product_faqs_propagate atualiza portais existentes quando products.faqs muda.
- Timeline do portal já vinha de project_phases via RPC get_portal_phases — não precisa de template.
- Materiais do portal foram removidos da UI há tempos (PortalView passa array vazio); por isso eliminados.
