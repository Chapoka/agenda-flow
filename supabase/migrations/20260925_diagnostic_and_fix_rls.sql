-- =============================================================================
-- 20260925: DIAGNOSTIC + FIX all RLS policies and GRANTs
-- Run this ENTIRE script in Supabase SQL Editor (https://agendaflow-supabase.fpczjb.easypanel.host)
-- =============================================================================

-- STEP 0: DIAGNOSTIC - Check what's currently on the database
-- ============================================================

-- Check: Does auth.uid() return a value for authenticated users?
SELECT auth.uid() AS current_uid;

-- Check: What role does PostgREST use?
SELECT current_setting('role') AS current_role;

-- Check: What policies exist on key tables?
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('users','user_companies','customers','customer_companies','appointments','invoices','companies','services','plans','templates')
ORDER BY tablename, cmd;

-- Check: What GRANTs exist for key roles?
SELECT grantee, table_name, string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE grantee IN ('authenticated','anon')
  AND table_name IN ('users','user_companies','customers','customer_companies','appointments','invoices','companies','services','plans','templates')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;

-- Check: Is RLS enabled and forced on key tables?
SELECT tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users','user_companies','customers','customer_companies','appointments','invoices')
ORDER BY tablename;

-- Check: Does the authenticator role chain exist?
SELECT rolname, rolsuper, rolcanlogin
FROM pg_roles
WHERE rolname IN ('anon','authenticated','authenticator','service_role','supabase_admin')
ORDER BY rolname;

-- Check: Does authenticator have GRANT authenticated TO authenticator?
SELECT m.roleid::regrole AS granted_role, m.member::regrole AS member_of
FROM pg_auth_members m
JOIN pg_roles r ON m.roleid = r.oid
WHERE r.rolname IN ('authenticated','anon','service_role')
ORDER BY r.rolname;


-- =============================================================================
-- STEP 1: FIX ROLE CHAIN (authenticator → authenticated)
-- =============================================================================
GRANT authenticated TO authenticator;
GRANT anon TO authenticator;
GRANT service_role TO authenticator;


-- =============================================================================
-- STEP 2: DROP ALL existing policies on key tables (clean slate)
-- =============================================================================

-- USERS
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users';
  END LOOP;
END $$;

-- USER_COMPANIES
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'user_companies' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.user_companies';
  END LOOP;
END $$;

-- CUSTOMERS
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'customers' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.customers';
  END LOOP;
END $$;

-- CUSTOMER_COMPANIES
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'customer_companies' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.customer_companies';
  END LOOP;
END $$;

-- APPOINTMENTS
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.appointments';
  END LOOP;
END $$;

-- INVOICES
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'invoices' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.invoices';
  END LOOP;
END $$;


-- =============================================================================
-- STEP 3: ENSURE RLS IS ENABLED (not forced - SECURITY DEFINER functions need to bypass)
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- STEP 4: CREATE CLEAN RLS POLICIES
-- =============================================================================

-- =============================================
-- USERS - allow authenticated users to read their own profile
-- =============================================
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (
    auth.uid() = id
  );

CREATE POLICY "users_select_super_admin" ON public.users
  FOR SELECT USING (
    public.is_super_admin()
  );

-- Allow admins to see users in their companies
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (
    role IN ('admin','profissional')
    AND EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = users.id
        AND public.user_owns_company(uc.company_id)
    )
  );

-- Super admin can update any user
CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE USING (
    public.is_super_admin()
    OR auth.uid() = id
  );

-- =============================================
-- USER_COMPANIES - super admin full access, users see their own
-- =============================================
CREATE POLICY "user_companies_all_authenticated" ON public.user_companies
  FOR ALL USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR public.user_owns_company(company_id)
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.user_owns_company(company_id)
  );

-- =============================================
-- CUSTOMERS - open read, authenticated write
-- =============================================
CREATE POLICY "customers_select" ON public.customers
  FOR SELECT USING (true);

CREATE POLICY "customers_insert" ON public.customers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customers_update" ON public.customers
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "customers_delete" ON public.customers
  FOR DELETE USING (
    public.is_super_admin() OR public.user_owns_company(company_id)
  );

-- =============================================
-- CUSTOMER_COMPANIES - open read, authenticated write
-- =============================================
CREATE POLICY "customer_companies_select" ON public.customer_companies
  FOR SELECT USING (true);

CREATE POLICY "customer_companies_insert" ON public.customer_companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "customer_companies_delete" ON public.customer_companies
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- =============================================
-- APPOINTMENTS - open read, authenticated write
-- =============================================
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT USING (true);

CREATE POLICY "appointments_insert" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_delete" ON public.appointments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- =============================================
-- INVOICES - open read, authenticated write
-- =============================================
CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT USING (true);

CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE USING (auth.uid() IS NOT NULL);


-- =============================================================================
-- STEP 5: GRANT PERMISSIONS
-- =============================================================================

-- customers
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT ON public.customers TO anon;

-- customer_companies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_companies TO authenticated;
GRANT SELECT ON public.customer_companies TO anon;

-- appointments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT ON public.appointments TO anon;

-- invoices
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT ON public.invoices TO anon;

-- companies (read for all)
GRANT SELECT ON public.companies TO authenticated;
GRANT SELECT ON public.companies TO anon;

-- services
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;

-- plans
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;

-- professional_services
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;

-- blocked_times
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_times TO authenticated;

-- templates
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;

-- waiting_list
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated;

-- punch_cards
GRANT SELECT, INSERT, UPDATE, DELETE ON public.punch_cards TO authenticated;

-- stylist_levels
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stylist_levels TO authenticated;

-- users
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- user_companies
GRANT SELECT, INSERT, DELETE ON public.user_companies TO authenticated;

-- establishment_types
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_types TO authenticated;

-- settings (login carousel etc)
GRANT SELECT ON public.settings TO authenticated;
GRANT SELECT ON public.settings TO anon;

-- modalities
GRANT SELECT ON public.modalities TO authenticated;


-- =============================================================================
-- STEP 6: BACKFILL user_companies for existing admin/profissional users
-- =============================================================================
DO $$ DECLARE r RECORD; BEGIN
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


-- =============================================================================
-- STEP 7: FINAL VERIFICATION
-- =============================================================================

-- Verify policies
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('users','user_companies','customers','customer_companies','appointments','invoices')
ORDER BY tablename, cmd;

-- Verify GRANTs for authenticated role
SELECT grantee, table_name, string_agg(DISTINCT privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_name IN ('users','user_companies','customers','customer_companies','appointments','invoices','companies')
GROUP BY grantee, table_name
ORDER BY table_name;

-- Verify customer exists
SELECT id, name, email, company_id, status FROM public.customers LIMIT 5;

-- Verify user_companies backfill
SELECT uc.user_id, u.email, u.role, uc.company_id
FROM public.user_companies uc
JOIN public.users u ON u.id = uc.user_id
LIMIT 10;
