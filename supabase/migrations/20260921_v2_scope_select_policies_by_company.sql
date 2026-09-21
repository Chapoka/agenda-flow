-- =============================================================================
-- 20260921_v2: Scope all SELECT policies by company
-- Previously USING(true) allowed any admin to see ALL data from ALL companies
-- Now restrict so admin only sees data belonging to their company
-- =============================================================================

-- COMPANIES: admin only sees their company
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (
    public.is_super_admin()
    OR id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- CUSTOMERS: admin only sees their company's customers
DROP POLICY IF EXISTS "customers_select" ON public.customers;

-- New policy: super_admin sees all, others see only their company's customers
-- Uses direct JOIN to user_companies (no SECURITY DEFINER dependency)
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
    OR id IN (
      SELECT cc.customer_id FROM public.customer_companies cc
      WHERE cc.company_id IN (
        SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
      )
    )
  );

-- Also fix services_select: admin should only see their company's services
DROP POLICY IF EXISTS "services_select" ON public.services;
CREATE POLICY "services_select" ON public.services
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Also fix plans_select: admin should only see their company's plans
DROP POLICY IF EXISTS "plans_select" ON public.plans;
CREATE POLICY "plans_select" ON public.plans
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Also fix templates_select: admin should only see their company's templates
DROP POLICY IF EXISTS "templates_select" ON public.templates;
CREATE POLICY "templates_select" ON public.templates
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Also fix blocked_times_select
DROP POLICY IF EXISTS "blocked_times_select" ON public.blocked_times;
CREATE POLICY "blocked_times_select" ON public.blocked_times
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Also fix appointments_select: should only see own company's appointments
DROP POLICY IF EXISTS "appointments_select" ON public.appointments;
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Verify
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('companies','customers','services','plans','templates','appointments','blocked_times')
ORDER BY tablename, cmd;
