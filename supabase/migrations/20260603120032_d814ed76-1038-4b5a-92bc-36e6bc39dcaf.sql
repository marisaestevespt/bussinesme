
DELETE FROM public.publico_alvo_sections;

INSERT INTO public.publico_alvo_sections (section_key, title, subtitle, nav_group, sort_order, content) VALUES
('perfil', 'Perfil', 'Quem é o nosso público-alvo', 'Framework', 1,
  '{"definicao":"","cards":[{"title":"Fase do negócio","text":""},{"title":"Estrutura de equipa","text":""},{"title":"Ferramentas atuais","text":""},{"title":"Contexto pessoal","text":""},{"title":"Consumo de conteúdo","text":""},{"title":"Relação com tecnologia","text":""}],"precisa":[],"naoEncaixa":[]}'::jsonb),
('personas', 'Personas', 'Perfis arquetípicos do público', 'Framework', 2,
  '{"items":[]}'::jsonb),
('mapa-emocional', 'Mapa Emocional', 'O que pensa, sente, faz e quer', 'Framework', 3,
  '{"pensa":[],"sente":[],"faz":[],"quer":[],"palavrasProblema":[],"palavrasQuer":[],"glossario":[]}'::jsonb),
('jornada', 'Jornada de Decisão', 'Consciência, temperatura e gatilhos', 'Framework', 4,
  '{"niveis":[{"nome":"Inconsciente","desc":"","badge":"","badgeColor":"muted","frase":""},{"nome":"Consciente do problema","desc":"","badge":"","badgeColor":"muted","frase":""},{"nome":"Consciente da solução","desc":"","badge":"","badgeColor":"muted","frase":""},{"nome":"Consciente do produto","desc":"","badge":"","badgeColor":"muted","frase":""},{"nome":"Mais consciente","desc":"","badge":"","badgeColor":"muted","frase":""}],"temperatura":{"fria":{"desc":"","ativada":""},"morna":{"desc":"","ativada":""},"quente":{"desc":"","ativada":""}},"ativa":[],"impede":[]}'::jsonb),
('voz', 'Voz & Comunicação', 'Tom, posicionamento e canais', 'Framework', 5,
  '{"tom":{"tags":[],"notas":""},"frases":[],"canais":{"chips":[{"label":"Instagram","active":false},{"label":"YouTube","active":false},{"label":"LinkedIn","active":false},{"label":"TikTok","active":false},{"label":"Email","active":false},{"label":"Podcast","active":false}],"notas":""}}'::jsonb);
