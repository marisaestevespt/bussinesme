DROP POLICY IF EXISTS block_suspended_users_modifier_dimensions ON public.product_modifier_dimensions;
CREATE POLICY block_suspended_users_modifier_dimensions ON public.product_modifier_dimensions AS RESTRICTIVE FOR ALL USING (NOT current_user_is_suspended());

DROP POLICY IF EXISTS block_suspended_users_modifier_levels ON public.product_modifier_levels;
CREATE POLICY block_suspended_users_modifier_levels ON public.product_modifier_levels AS RESTRICTIVE FOR ALL USING (NOT current_user_is_suspended());

DROP POLICY IF EXISTS block_suspended_users_drivers ON public.product_pricing_drivers;
CREATE POLICY block_suspended_users_drivers ON public.product_pricing_drivers AS RESTRICTIVE FOR ALL USING (NOT current_user_is_suspended());

DROP POLICY IF EXISTS block_suspended_users_quotes ON public.product_quotes;
CREATE POLICY block_suspended_users_quotes ON public.product_quotes AS RESTRICTIVE FOR ALL USING (NOT current_user_is_suspended());