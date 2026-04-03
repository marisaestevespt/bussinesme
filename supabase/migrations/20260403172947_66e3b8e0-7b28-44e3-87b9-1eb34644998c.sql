CREATE TABLE public.email_template_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  emoji TEXT,
  title_text TEXT,
  subtitle_text TEXT,
  cta_text TEXT,
  footer_text TEXT,
  primary_color TEXT,
  primary_foreground TEXT,
  text_color TEXT,
  muted_color TEXT,
  font_display TEXT,
  font_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read email template settings"
  ON public.email_template_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert email template settings"
  ON public.email_template_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update email template settings"
  ON public.email_template_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);