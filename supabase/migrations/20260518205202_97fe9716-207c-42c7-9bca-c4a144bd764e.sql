
-- ai_conversations
DROP POLICY IF EXISTS "Users manage own conversations" ON public.ai_conversations;
CREATE POLICY "ai_conversations select own" ON public.ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations insert own" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations update own" ON public.ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations delete own" ON public.ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_messages
DROP POLICY IF EXISTS "Users manage own messages" ON public.ai_messages;
CREATE POLICY "ai_messages select own" ON public.ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_messages insert own" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_messages update own" ON public.ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_messages delete own" ON public.ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ritual_banner_state
DROP POLICY IF EXISTS "Users manage their own ritual state" ON public.ritual_banner_state;
CREATE POLICY "ritual_banner_state select own" ON public.ritual_banner_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ritual_banner_state insert own" ON public.ritual_banner_state FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ritual_banner_state update own" ON public.ritual_banner_state FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ritual_banner_state delete own" ON public.ritual_banner_state FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- monthly_reflection
DROP POLICY IF EXISTS "monthly_reflection owner full access" ON public.monthly_reflection;
CREATE POLICY "monthly_reflection select owner" ON public.monthly_reflection FOR SELECT TO authenticated USING (is_owner());
CREATE POLICY "monthly_reflection insert owner" ON public.monthly_reflection FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY "monthly_reflection update owner" ON public.monthly_reflection FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "monthly_reflection delete owner" ON public.monthly_reflection FOR DELETE TO authenticated USING (is_owner());

-- visao_5_anos
DROP POLICY IF EXISTS "visao_5_anos owner full access" ON public.visao_5_anos;
CREATE POLICY "visao_5_anos select owner" ON public.visao_5_anos FOR SELECT TO authenticated USING (is_owner());
CREATE POLICY "visao_5_anos insert owner" ON public.visao_5_anos FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY "visao_5_anos update owner" ON public.visao_5_anos FOR UPDATE TO authenticated USING (is_owner()) WITH CHECK (is_owner());
CREATE POLICY "visao_5_anos delete owner" ON public.visao_5_anos FOR DELETE TO authenticated USING (is_owner());
