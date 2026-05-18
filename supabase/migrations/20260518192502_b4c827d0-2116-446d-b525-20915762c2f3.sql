-- Conversations
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id, archived, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations"
ON public.ai_conversations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Messages
CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  action_proposal JSONB,
  confirmed BOOLEAN,
  file JSONB,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id, created_at ASC);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own messages"
ON public.ai_messages
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Touch updated_at on conversation when a message arrives
CREATE OR REPLACE FUNCTION public.touch_ai_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_ai_conversation
AFTER INSERT ON public.ai_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_ai_conversation();