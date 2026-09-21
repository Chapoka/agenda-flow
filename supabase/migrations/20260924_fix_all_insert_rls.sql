-- 20260924: Fix ALL INSERT RLS for customer creation flow
-- Customers + customer_companies + appointments + invoices

-- 1. Backfill user_companies
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT u.id AS user_id, u.company_id FROM public.users u
    WHERE u.role IN ('admin','profissional') AND u.company_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.user_companies uc WHERE uc.user_id = u.id AND uc.company_id = u.company_id)
  LOOP
    INSERT INTO public.user_companies (user_id, company_id) VALUES (r.user_id, r.company_id) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 2. customers INSERT
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. customer_companies INSERT (for setCustomerCompanies)
DROP POLICY IF EXISTS "customer_companies_insert" ON customer_companies;
CREATE POLICY "customer_companies_insert" ON customer_companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 4. customer_companies DELETE (for setCustomerCompanies - deletes before re-inserting)
DROP POLICY IF EXISTS "customer_companies_delete" ON customer_companies;
CREATE POLICY "customer_companies_delete" ON customer_companies
  FOR DELETE USING (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
  );

-- 5. appointments INSERT
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. invoices INSERT
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Verify: show all INSERT policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE cmd = 'INSERT'
ORDER BY tablename;
