-- Apagar task órfã de "Novo Conteúdo" (resíduo de auto-criação antiga)
DELETE FROM public.tasks WHERE id = '8c35a17c-de5f-4ebe-b6ab-bfd28c496c01';
