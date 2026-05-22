
-- 1) Tighten realtime.messages: topic must contain the user's own uid
DROP POLICY IF EXISTS "realtime_authenticated_only" ON realtime.messages;

CREATE POLICY "realtime_topic_scoped_to_user"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

-- 2) Replace always-true policies on KPI / quarterly tables with authenticated-only
-- department_kpi_monthly
DROP POLICY IF EXISTS "Authenticated can delete dkm" ON public.department_kpi_monthly;
DROP POLICY IF EXISTS "Authenticated can insert dkm" ON public.department_kpi_monthly;
DROP POLICY IF EXISTS "Authenticated can update dkm" ON public.department_kpi_monthly;

CREATE POLICY "Authenticated can insert dkm"
ON public.department_kpi_monthly
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update dkm"
ON public.department_kpi_monthly
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete dkm"
ON public.department_kpi_monthly
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- department_kpi_quarterly
DROP POLICY IF EXISTS "Authenticated can delete dkq" ON public.department_kpi_quarterly;
DROP POLICY IF EXISTS "Authenticated can insert dkq" ON public.department_kpi_quarterly;
DROP POLICY IF EXISTS "Authenticated can update dkq" ON public.department_kpi_quarterly;

CREATE POLICY "Authenticated can insert dkq"
ON public.department_kpi_quarterly
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update dkq"
ON public.department_kpi_quarterly
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete dkq"
ON public.department_kpi_quarterly
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- quarterly_items
DROP POLICY IF EXISTS "auth del qi" ON public.quarterly_items;
DROP POLICY IF EXISTS "auth ins qi" ON public.quarterly_items;
DROP POLICY IF EXISTS "auth upd qi" ON public.quarterly_items;

CREATE POLICY "auth ins qi"
ON public.quarterly_items
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth upd qi"
ON public.quarterly_items
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth del qi"
ON public.quarterly_items
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

-- quarterly_plans
DROP POLICY IF EXISTS "auth del qp" ON public.quarterly_plans;
DROP POLICY IF EXISTS "auth ins qp" ON public.quarterly_plans;
DROP POLICY IF EXISTS "auth upd qp" ON public.quarterly_plans;

CREATE POLICY "auth ins qp"
ON public.quarterly_plans
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth upd qp"
ON public.quarterly_plans
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth del qp"
ON public.quarterly_plans
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);
