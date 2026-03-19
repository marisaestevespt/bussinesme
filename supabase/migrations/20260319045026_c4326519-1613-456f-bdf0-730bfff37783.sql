ALTER TABLE public.commercial_sales ALTER COLUMN documents TYPE jsonb USING 
  CASE 
    WHEN documents IS NULL OR documents = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(jsonb_build_object('type', 'link', 'url', documents, 'name', documents))
  END;

ALTER TABLE public.commercial_sales ALTER COLUMN documents SET DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public) VALUES ('commercial-files', 'commercial-files', true) ON CONFLICT DO NOTHING;