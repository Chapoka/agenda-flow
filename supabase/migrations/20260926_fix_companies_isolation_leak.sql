-- 20260926: Fix vazamento de Empresas (filiais) no cadastro de cliente
-- Admin com 1 empresa via user_companies via RLS usando user_owns_company
-- Antes: customers/appointments/customer_companies com USING(true) permitiam qualquer admin listar todas as empresas
-- Agora: admin só vê dados da(s) empresa(s) vinculada(s) ao seu cadastro
-- super_admin continua vendo tudo

-- COMPANIES: admin só vê empresa(s) vinculada(s)
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (
    public.is_super_admin()
    OR id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- CUSTOMERS: admin só vê clientes da(s) sua(s) empresa(s)
DROP POLICY IF EXISTS "customers_select" ON public.customers;
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

-- CUSTOMER_COMPANIES: admin só vê vínculos da(s) sua(s) empresa(s)
DROP POLICY IF EXISTS "customer_companies_select" ON public.customer_companies;
CREATE POLICY "customer_companies_select" ON public.customer_companies
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- APPOINTMENTS: admin só vê agendamentos da(s) sua(s) empresa(s)
DROP POLICY IF EXISTS "appointments_select" ON public.appointments;
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- INVOICES: admin só vê faturas da(s) sua(s) empresa(s)
DROP POLICY IF EXISTS "invoices_select" ON public.invoices;
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT USING (
    public.is_super_admin()
    OR company_id IN (
      SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

-- Verifica
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename IN ('companies','customers','customer_companies','appointments','invoices')
ORDER BY tablename, cmd;
