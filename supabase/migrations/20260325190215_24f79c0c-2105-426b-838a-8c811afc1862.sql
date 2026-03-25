
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_role_module_unique ON public.role_permissions (custom_role_id, module_key);
