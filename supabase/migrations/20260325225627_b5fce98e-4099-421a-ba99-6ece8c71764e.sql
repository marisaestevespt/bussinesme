
-- ============================================================
-- SECURITY FIX: Restrict executive & sensitive tables to owner-only mutations
-- Keeps SELECT open to authenticated, restricts INSERT/UPDATE/DELETE to owner
-- ============================================================

-- Helper: Drop ALL policy and create granular ones
-- EXECUTIVE TABLES (6 tables)

-- 1. executive_brain_dump
DROP POLICY IF EXISTS "Authenticated users can manage executive_brain_dump" ON public.executive_brain_dump;
CREATE POLICY "Authenticated can view executive_brain_dump" ON public.executive_brain_dump FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert executive_brain_dump" ON public.executive_brain_dump FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update executive_brain_dump" ON public.executive_brain_dump FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete executive_brain_dump" ON public.executive_brain_dump FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 2. executive_objectives
DROP POLICY IF EXISTS "Authenticated users can manage executive_objectives" ON public.executive_objectives;
CREATE POLICY "Authenticated can view executive_objectives" ON public.executive_objectives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert executive_objectives" ON public.executive_objectives FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update executive_objectives" ON public.executive_objectives FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete executive_objectives" ON public.executive_objectives FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 3. executive_goals
DROP POLICY IF EXISTS "Authenticated users can manage executive_goals" ON public.executive_goals;
CREATE POLICY "Authenticated can view executive_goals" ON public.executive_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert executive_goals" ON public.executive_goals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update executive_goals" ON public.executive_goals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete executive_goals" ON public.executive_goals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 4. executive_monthly_checklists
DROP POLICY IF EXISTS "Authenticated users can manage executive_monthly_checklists" ON public.executive_monthly_checklists;
CREATE POLICY "Authenticated can view executive_monthly_checklists" ON public.executive_monthly_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert executive_monthly_checklists" ON public.executive_monthly_checklists FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update executive_monthly_checklists" ON public.executive_monthly_checklists FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete executive_monthly_checklists" ON public.executive_monthly_checklists FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 5. executive_quarterly_analysis
DROP POLICY IF EXISTS "Authenticated users can manage executive_quarterly_analysis" ON public.executive_quarterly_analysis;
CREATE POLICY "Authenticated can view executive_quarterly_analysis" ON public.executive_quarterly_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert executive_quarterly_analysis" ON public.executive_quarterly_analysis FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update executive_quarterly_analysis" ON public.executive_quarterly_analysis FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete executive_quarterly_analysis" ON public.executive_quarterly_analysis FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 6. executive_weekly_routines
DROP POLICY IF EXISTS "Authenticated users can manage executive_weekly_routines" ON public.executive_weekly_routines;
CREATE POLICY "Authenticated can view executive_weekly_routines" ON public.executive_weekly_routines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert executive_weekly_routines" ON public.executive_weekly_routines FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update executive_weekly_routines" ON public.executive_weekly_routines FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete executive_weekly_routines" ON public.executive_weekly_routines FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- BUSINESS PLAN & SETUP (4 tables)

-- 7. business_plan_cards
DROP POLICY IF EXISTS "Authenticated full access" ON public.business_plan_cards;
CREATE POLICY "Authenticated can view business_plan_cards" ON public.business_plan_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert business_plan_cards" ON public.business_plan_cards FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update business_plan_cards" ON public.business_plan_cards FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete business_plan_cards" ON public.business_plan_cards FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 8. business_plan_custom_columns
DROP POLICY IF EXISTS "Authenticated full access" ON public.business_plan_custom_columns;
CREATE POLICY "Authenticated can view business_plan_custom_columns" ON public.business_plan_custom_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert business_plan_custom_columns" ON public.business_plan_custom_columns FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update business_plan_custom_columns" ON public.business_plan_custom_columns FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete business_plan_custom_columns" ON public.business_plan_custom_columns FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 9. business_plan_settings
DROP POLICY IF EXISTS "Authenticated full access" ON public.business_plan_settings;
CREATE POLICY "Authenticated can view business_plan_settings" ON public.business_plan_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert business_plan_settings" ON public.business_plan_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update business_plan_settings" ON public.business_plan_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete business_plan_settings" ON public.business_plan_settings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 10. business_setup
DROP POLICY IF EXISTS "Authenticated users can manage business setup" ON public.business_setup;
CREATE POLICY "Authenticated can view business_setup" ON public.business_setup FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert business_setup" ON public.business_setup FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update business_setup" ON public.business_setup FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete business_setup" ON public.business_setup FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- SENSITIVE HR TABLES (5 tables)

-- 11. member_contracts
DROP POLICY IF EXISTS "Authenticated users can manage member_contracts" ON public.member_contracts;
CREATE POLICY "Authenticated can view member_contracts" ON public.member_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert member_contracts" ON public.member_contracts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update member_contracts" ON public.member_contracts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete member_contracts" ON public.member_contracts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 12. member_payments
DROP POLICY IF EXISTS "Authenticated users can manage member_payments" ON public.member_payments;
CREATE POLICY "Authenticated can view member_payments" ON public.member_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert member_payments" ON public.member_payments FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update member_payments" ON public.member_payments FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete member_payments" ON public.member_payments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 13. member_onboarding
DROP POLICY IF EXISTS "Authenticated users can manage member_onboarding" ON public.member_onboarding;
CREATE POLICY "Authenticated can view member_onboarding" ON public.member_onboarding FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert member_onboarding" ON public.member_onboarding FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update member_onboarding" ON public.member_onboarding FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete member_onboarding" ON public.member_onboarding FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 14. feedback_sessions
DROP POLICY IF EXISTS "Authenticated users can manage feedback_sessions" ON public.feedback_sessions;
CREATE POLICY "Authenticated can view feedback_sessions" ON public.feedback_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert feedback_sessions" ON public.feedback_sessions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update feedback_sessions" ON public.feedback_sessions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete feedback_sessions" ON public.feedback_sessions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 15. performance_monthly
DROP POLICY IF EXISTS "Authenticated users can manage performance_monthly" ON public.performance_monthly;
CREATE POLICY "Authenticated can view performance_monthly" ON public.performance_monthly FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert performance_monthly" ON public.performance_monthly FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update performance_monthly" ON public.performance_monthly FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete performance_monthly" ON public.performance_monthly FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 16. performance_weekly
DROP POLICY IF EXISTS "Authenticated users can manage performance_weekly" ON public.performance_weekly;
CREATE POLICY "Authenticated can view performance_weekly" ON public.performance_weekly FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert performance_weekly" ON public.performance_weekly FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update performance_weekly" ON public.performance_weekly FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete performance_weekly" ON public.performance_weekly FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- OTHER SENSITIVE TABLES

-- 17. capacity_scenarios
DROP POLICY IF EXISTS "Authenticated users can manage capacity_scenarios" ON public.capacity_scenarios;
CREATE POLICY "Authenticated can view capacity_scenarios" ON public.capacity_scenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert capacity_scenarios" ON public.capacity_scenarios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update capacity_scenarios" ON public.capacity_scenarios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete capacity_scenarios" ON public.capacity_scenarios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 18. capacity_scenario_products
DROP POLICY IF EXISTS "Authenticated users can manage capacity_scenario_products" ON public.capacity_scenario_products;
CREATE POLICY "Authenticated can view capacity_scenario_products" ON public.capacity_scenario_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert capacity_scenario_products" ON public.capacity_scenario_products FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update capacity_scenario_products" ON public.capacity_scenario_products FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete capacity_scenario_products" ON public.capacity_scenario_products FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 19. hiring_simulations
DROP POLICY IF EXISTS "Authenticated users can manage simulations" ON public.hiring_simulations;
CREATE POLICY "Authenticated can view hiring_simulations" ON public.hiring_simulations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert hiring_simulations" ON public.hiring_simulations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update hiring_simulations" ON public.hiring_simulations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete hiring_simulations" ON public.hiring_simulations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 20. innovation_docs
DROP POLICY IF EXISTS "Authenticated full access" ON public.innovation_docs;
CREATE POLICY "Authenticated can view innovation_docs" ON public.innovation_docs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert innovation_docs" ON public.innovation_docs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update innovation_docs" ON public.innovation_docs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete innovation_docs" ON public.innovation_docs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 21. innovation_ideas
DROP POLICY IF EXISTS "Authenticated full access" ON public.innovation_ideas;
CREATE POLICY "Authenticated can view innovation_ideas" ON public.innovation_ideas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert innovation_ideas" ON public.innovation_ideas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update innovation_ideas" ON public.innovation_ideas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete innovation_ideas" ON public.innovation_ideas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 22. planning_goals
DROP POLICY IF EXISTS "Authenticated users can manage planning_goals" ON public.planning_goals;
CREATE POLICY "Authenticated can view planning_goals" ON public.planning_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert planning_goals" ON public.planning_goals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update planning_goals" ON public.planning_goals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete planning_goals" ON public.planning_goals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 23. metric_history
DROP POLICY IF EXISTS "Authenticated users can manage metric_history" ON public.metric_history;
CREATE POLICY "Authenticated can view metric_history" ON public.metric_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can insert metric_history" ON public.metric_history FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can update metric_history" ON public.metric_history FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner can delete metric_history" ON public.metric_history FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
