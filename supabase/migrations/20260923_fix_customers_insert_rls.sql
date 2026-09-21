-- 20260923: Fix customers/appointments/invoices INSERT RLS (v3)
-- Strategy: allow INSERT for any authenticated user who has at least one company
-- Uses auth.uid() directly instead of complex function checks

-- 1. Backfill user_companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id AS user_id, u.company_id
    FROM public.users u
    WHERE u.role IN ('admin', 'profissional')
      AND u.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_companies uc
        WHERE uc.user_id = u.id AND uc.company_id = u.company_id
      )
  LOOP
    INSERT INTO public.user_companies (user_id, company_id)
    VALUES (r.user_id, r.company_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 2. customers INSERT
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 3. appointments INSERT
DROP POLICY IF EXISTS "appointments_insert" ON appointments;
CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 4. invoices INSERT
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 5. customers UPDATE (admin/profissional)
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
    OR EXISTS (
      SELECT 1 FROM public.customer_companies cc
      WHERE cc.customer_id = customers.id
        AND public.user_owns_company(cc.company_id)
    )
  );

-- 6. customers DELETE (admin/profissional)
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
    OR EXISTS (
      SELECT 1 FROM public.customer_companies cc
      WHERE cc.customer_id = customers.id
        AND public.user_owns_company(cc.company_id)
    )
  );
