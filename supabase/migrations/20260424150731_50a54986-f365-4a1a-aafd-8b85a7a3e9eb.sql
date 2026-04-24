
-- ============================================================
-- PACOTE SEGURANÇA P0 (estratégia ADD VALUE)
-- Adiciona 5 novos valores ao enum sem reescrever policies existentes.
-- ============================================================

-- A.1 — Adicionar novos valores ao enum app_role (owner/admin/member já existem)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
