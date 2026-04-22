-- Tabela de contas associadas a cada canal de marketing
CREATE TABLE public.marketing_channel_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  url TEXT,
  label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_channel_accounts_channel ON public.marketing_channel_accounts(channel_id);

ALTER TABLE public.marketing_channel_accounts ENABLE ROW LEVEL SECURITY;

-- Mesma política das outras tabelas marketing: leitura para todos autenticados, escrita para owners
CREATE POLICY "Authenticated can view channel accounts"
ON public.marketing_channel_accounts FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Owners can insert channel accounts"
ON public.marketing_channel_accounts FOR INSERT
TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update channel accounts"
ON public.marketing_channel_accounts FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete channel accounts"
ON public.marketing_channel_accounts FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_marketing_channel_accounts_updated_at
BEFORE UPDATE ON public.marketing_channel_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar account_id a content_items para associar conteúdo a uma conta específica
ALTER TABLE public.content_items
ADD COLUMN account_id UUID REFERENCES public.marketing_channel_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_content_items_account ON public.content_items(account_id);