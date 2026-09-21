-- 20260924: Final RLS fix - customers, customer_companies, appointments, invoices
-- Step 1: drop all old policies, step 2: create clean ones

-- =============================================
-- CUSTOMERS
-- =============================================
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'customers' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON customers';
  END LOOP;
END $$;

CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (true);

CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (
    public.is_super_admin() OR public.user_owns_company(company_id)
  );

-- =============================================
-- CUSTOMER_COMPANIES
-- =============================================
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'customer_companies' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON customer_companies';
  END LOOP;
END $$;

CREATE POLICY "customer_companies_select" ON customer_companies
  FOR SELECT USING (true);

CREATE POLICY "customer_companies_insert" ON customer_companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customer_companies_delete" ON customer_companies
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- =============================================
-- APPOINTMENTS
-- =============================================
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON appointments';
  END LOOP;
END $$;

CREATE POLICY "appointments_select" ON appointments
  FOR SELECT USING (true);

CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_update" ON appointments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_delete" ON appointments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- =============================================
-- INVOICES
-- =============================================
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'invoices' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON invoices';
  END LOOP;
END $$;

CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (true);

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Verify all
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('customers','customer_companies','appointments','invoices')
ORDER BY tablename, cmd;
