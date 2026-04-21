
-- Remove redundant sections
DELETE FROM publico_alvo_sections WHERE section_key IN ('anti-persona','investigar');

-- Regroup remaining sections
UPDATE publico_alvo_sections SET nav_group = 'Personas' WHERE section_key IN ('personas','mapa-mental');
UPDATE publico_alvo_sections SET nav_group = 'Psicologia de compra' WHERE section_key IN ('niveis-consciencia','nivel-comprador','jornada-emocional');
UPDATE publico_alvo_sections SET nav_group = 'Dores e Desejos' WHERE section_key IN ('dores','desejos','tentaram');
UPDATE publico_alvo_sections SET nav_group = 'Decisão e Comunicação' WHERE section_key IN ('objecoes','triggers','linguagem','frases');

-- Reorder sort_order to match new groups
UPDATE publico_alvo_sections SET sort_order = 2 WHERE section_key = 'personas';
UPDATE publico_alvo_sections SET sort_order = 3 WHERE section_key = 'mapa-mental';
UPDATE publico_alvo_sections SET sort_order = 4 WHERE section_key = 'niveis-consciencia';
UPDATE publico_alvo_sections SET sort_order = 5 WHERE section_key = 'nivel-comprador';
UPDATE publico_alvo_sections SET sort_order = 6 WHERE section_key = 'jornada-emocional';
UPDATE publico_alvo_sections SET sort_order = 7 WHERE section_key = 'dores';
UPDATE publico_alvo_sections SET sort_order = 8 WHERE section_key = 'desejos';
UPDATE publico_alvo_sections SET sort_order = 9 WHERE section_key = 'tentaram';
UPDATE publico_alvo_sections SET sort_order = 10 WHERE section_key = 'objecoes';
UPDATE publico_alvo_sections SET sort_order = 11 WHERE section_key = 'triggers';
UPDATE publico_alvo_sections SET sort_order = 12 WHERE section_key = 'linguagem';
UPDATE publico_alvo_sections SET sort_order = 13 WHERE section_key = 'frases';
