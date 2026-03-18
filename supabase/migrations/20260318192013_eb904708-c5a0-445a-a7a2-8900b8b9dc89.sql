
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS welcome_text text DEFAULT 'Olá! Bem-vindo(a) ao nosso espaço. Este é o lugar onde organizamos, colaboramos e crescemos juntos.',
  ADD COLUMN IF NOT EXISTS about_text text DEFAULT 'Somos uma equipa dedicada a criar valor e impacto. Aqui encontras tudo o que precisas para colaborar, comunicar e acompanhar o nosso trabalho.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS work_schedule text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS role_title text;
