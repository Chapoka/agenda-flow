-- 20260923: Fix customers INSERT RLS
-- Policy original: user_owns_company(company_id) only — no super_admin bypass
-- Fix: add is_super_admin() + ensure admin has user_companies entry

-- 1. Garantir que admins tenham entry em user_companies para suas empresas
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

-- 2. Corrigir policy INSERT de customers
DROP POLICY IF EXISTS "customers_insert" ON customers;

CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
  );
