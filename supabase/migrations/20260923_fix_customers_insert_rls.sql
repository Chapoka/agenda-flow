-- 20260923: Fix customers INSERT RLS (v2)
-- Admin e profissional precisam criar clientes mesmo quando company_id pode estar null
-- Strategy: allow INSERT if user owns at least one company (super_admin OR has company via user_companies)

-- 1. Backfill: garantir que admins/profissionais tenham entry em user_companies
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
    OR EXISTS (SELECT 1 FROM public.get_user_company_ids() LIMIT 1)
  );

-- 3. Corrigir policy INSERT de appointments (agendamentos)
DROP POLICY IF EXISTS "appointments_insert" ON appointments;

CREATE POLICY "appointments_insert" ON appointments
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
  );

-- 4. Corrigir policy INSERT de invoices (cobranças)
DROP POLICY IF EXISTS "invoices_insert" ON invoices;

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
  );
