
-- ===== PHASE A: Critical sensitive data hardening =====
-- Lock financial operational tables behind owner OR sensitive_access('financial_values')

-- financial_expenses
DROP POLICY IF EXISTS "Authenticated can view expenses" ON public.financial_expenses;
DROP POLICY IF EXISTS "Authenticated can insert expenses" ON public.financial_expenses;
DROP POLICY IF EXISTS "Authenticated can update expenses" ON public.financial_expenses;
CREATE POLICY "Owner or sensitive views expenses" ON public.financial_expenses
  FOR SELECT USING (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));
CREATE POLICY "Owner or sensitive inserts expenses" ON public.financial_expenses
  FOR INSERT WITH CHECK (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));
CREATE POLICY "Owner or sensitive updates expenses" ON public.financial_expenses
  FOR UPDATE USING (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));

-- financial_subscriptions
DROP POLICY IF EXISTS "Authenticated can view subscriptions" ON public.financial_subscriptions;
DROP POLICY IF EXISTS "Authenticated can insert subscriptions" ON public.financial_subscriptions;
DROP POLICY IF EXISTS "Authenticated can update subscriptions" ON public.financial_subscriptions;
CREATE POLICY "Owner or sensitive views subscriptions" ON public.financial_subscriptions
  FOR SELECT USING (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));
CREATE POLICY "Owner or sensitive inserts subscriptions" ON public.financial_subscriptions
  FOR INSERT WITH CHECK (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));
CREATE POLICY "Owner or sensitive updates subscriptions" ON public.financial_subscriptions
  FOR UPDATE USING (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));

-- financial_categories: keep readable (taxonomy), restrict writes
DROP POLICY IF EXISTS "Authenticated users can insert financial categories" ON public.financial_categories;
DROP POLICY IF EXISTS "Authenticated users can delete financial categories" ON public.financial_categories;
CREATE POLICY "Owner or sensitive inserts financial categories" ON public.financial_categories
  FOR INSERT WITH CHECK (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));
CREATE POLICY "Owner or sensitive deletes financial categories" ON public.financial_categories
  FOR DELETE USING (has_role(auth.uid(),'owner') OR current_user_has_sensitive_access('financial_values'));

-- financial_invoices (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='financial_invoices') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.financial_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can insert invoices" ON public.financial_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can update invoices" ON public.financial_invoices';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can delete invoices" ON public.financial_invoices';
    EXECUTE 'CREATE POLICY "Owner or sensitive views invoices" ON public.financial_invoices FOR SELECT USING (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
    EXECUTE 'CREATE POLICY "Owner or sensitive inserts invoices" ON public.financial_invoices FOR INSERT WITH CHECK (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
    EXECUTE 'CREATE POLICY "Owner or sensitive updates invoices" ON public.financial_invoices FOR UPDATE USING (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
    EXECUTE 'CREATE POLICY "Owner or sensitive deletes invoices" ON public.financial_invoices FOR DELETE USING (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
  END IF;
END $$;

-- financial_revenues (if exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='financial_revenues') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can view revenues" ON public.financial_revenues';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can insert revenues" ON public.financial_revenues';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can update revenues" ON public.financial_revenues';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can delete revenues" ON public.financial_revenues';
    EXECUTE 'CREATE POLICY "Owner or sensitive views revenues" ON public.financial_revenues FOR SELECT USING (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
    EXECUTE 'CREATE POLICY "Owner or sensitive inserts revenues" ON public.financial_revenues FOR INSERT WITH CHECK (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
    EXECUTE 'CREATE POLICY "Owner or sensitive updates revenues" ON public.financial_revenues FOR UPDATE USING (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
    EXECUTE 'CREATE POLICY "Owner or sensitive deletes revenues" ON public.financial_revenues FOR DELETE USING (has_role(auth.uid(),''owner'') OR current_user_has_sensitive_access(''financial_values''))';
  END IF;
END $$;

-- feedback_sessions: SELECT restricted to owner + self-recipient
DROP POLICY IF EXISTS "Authenticated can view feedback_sessions" ON public.feedback_sessions;
CREATE POLICY "Owner or self views feedback_sessions" ON public.feedback_sessions
  FOR SELECT USING (
    has_role(auth.uid(),'owner')
    OR (member_id IS NOT NULL AND is_self_team_member(member_id))
  );

-- performance_monthly: owner OR self
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='performance_monthly') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can view performance_monthly" ON public.performance_monthly';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated views performance_monthly" ON public.performance_monthly';
    EXECUTE 'CREATE POLICY "Owner or self views performance_monthly" ON public.performance_monthly FOR SELECT USING (has_role(auth.uid(),''owner'') OR (member_id IS NOT NULL AND is_self_team_member(member_id)))';
  END IF;
END $$;

-- client_contacts: drop ALL-true, allow team SELECT, restrict writes to owner/admin
DROP POLICY IF EXISTS "Authenticated users can manage client contacts" ON public.client_contacts;
CREATE POLICY "Authenticated views client_contacts" ON public.client_contacts FOR SELECT USING (true);
CREATE POLICY "Owner or admin inserts client_contacts" ON public.client_contacts
  FOR INSERT WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin updates client_contacts" ON public.client_contacts
  FOR UPDATE USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
CREATE POLICY "Owner or admin deletes client_contacts" ON public.client_contacts
  FOR DELETE USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin'));
