-- ═══════════════════════════════════════════════════════════════════════════
-- J — FIXES MURAL + ACESSOS + MARKETING
-- ═══════════════════════════════════════════════════════════════════════════

-- ── J1 MURAL ──────────────────────────────────────────────────────────────

-- J1.A: Policy INSERT em mural_posts (estava em falta — bloqueava criacao)
CREATE POLICY "Users can insert own mural posts"
ON public.mural_posts
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

-- J1.B: FKs com ON DELETE SET NULL para author_id / user_id
-- (autor eliminado nao apaga conteudo historico, apenas perde a referencia)
-- Nota: como as colunas sao NOT NULL, usamos ON DELETE CASCADE em vez de SET NULL
ALTER TABLE public.mural_posts
  ADD CONSTRAINT mural_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.mural_comments
  ADD CONSTRAINT mural_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.mural_reactions
  ADD CONSTRAINT mural_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- J1.C: UNIQUE em (post_id, user_id, emoji) — uma reacao por emoji por user
ALTER TABLE public.mural_reactions
  ADD CONSTRAINT mural_reactions_unique_per_user_emoji
  UNIQUE (post_id, user_id, emoji);

-- J1.D: CHECK constraint em category
ALTER TABLE public.mural_posts
  ADD CONSTRAINT mural_posts_category_check
  CHECK (category IN ('anuncio', 'novidade', 'atualizacao', 'lembrete', 'outro'));

-- ── J2 ACESSOS ────────────────────────────────────────────────────────────

-- J2.B: FK created_by → ON DELETE SET NULL (em vez de bloquear)
ALTER TABLE public.platform_accesses
  DROP CONSTRAINT platform_accesses_created_by_fkey;

ALTER TABLE public.platform_accesses
  ADD CONSTRAINT platform_accesses_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- J2.C: FKs em access_password_audit
ALTER TABLE public.access_password_audit
  ADD CONSTRAINT access_password_audit_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.access_password_audit
  ADD CONSTRAINT access_password_audit_access_id_fkey
  FOREIGN KEY (access_id) REFERENCES public.platform_accesses(id) ON DELETE SET NULL;

-- J2.E: CHECK em platform_type
ALTER TABLE public.platform_accesses
  ADD CONSTRAINT platform_accesses_platform_type_check
  CHECK (platform_type IN ('redes_sociais', 'email', 'pagamentos', 'cloud', 'website', 'analytics', 'crm', 'outros'));

-- ── J3 MARKETING ──────────────────────────────────────────────────────────

-- J3.A: DELETE policy em marketing_pages (owner)
CREATE POLICY "Owners can delete marketing pages"
ON public.marketing_pages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- J3.B: Restringir marketing_channel_accounts a owner-only
DROP POLICY IF EXISTS "auth manage marketing_channel_accounts" ON public.marketing_channel_accounts;

CREATE POLICY "Authenticated can view marketing channel accounts"
ON public.marketing_channel_accounts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Owners can manage marketing channel accounts"
ON public.marketing_channel_accounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));