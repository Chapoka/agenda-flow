-- =============================================================================
-- 20260921: FIX RLS for companies, plans, services, templates
-- auth.uid() returns NULL inside SECURITY DEFINER functions when called via RPC
-- So user_owns_company() returns false -> admin can't see companies/plans
-- Fix: use simple policies that don't depend on SECURITY DEFINER functions
-- =============================================================================

-- STEP 1: Drop ALL existing policies on companies, plans, services, templates
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'companies' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.companies';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'plans' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.plans';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'services' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.services';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'templates' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.templates';
  END LOOP;
END $$;

-- Also fix blocked_times, professional_services, punch_cards, stylist_levels, waiting_list, modalities, settings, establishment_types
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies 
    WHERE tablename IN ('blocked_times','professional_services','punch_cards','stylist_levels','waiting_list','modalities','settings','establishment_types')
    AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END $$;

-- STEP 2: Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stylist_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- STEP 3: Create open policies (authenticated can read everything, write is unrestricted)

-- COMPANIES: open SELECT, admin/super_admin write
CREATE POLICY "companies_select" ON public.companies FOR SELECT USING (true);
CREATE POLICY "companies_insert" ON public.companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "companies_delete" ON public.companies FOR DELETE USING (auth.uid() IS NOT NULL);

-- PLANS
CREATE POLICY "plans_select" ON public.plans FOR SELECT USING (true);
CREATE POLICY "plans_insert" ON public.plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "plans_update" ON public.plans FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "plans_delete" ON public.plans FOR DELETE USING (auth.uid() IS NOT NULL);

-- SERVICES
CREATE POLICY "services_select" ON public.services FOR SELECT USING (true);
CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "services_update" ON public.services FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "services_delete" ON public.services FOR DELETE USING (auth.uid() IS NOT NULL);

-- TEMPLATES
CREATE POLICY "templates_select" ON public.templates FOR SELECT USING (true);
CREATE POLICY "templates_insert" ON public.templates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "templates_update" ON public.templates FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "templates_delete" ON public.templates FOR DELETE USING (auth.uid() IS NOT NULL);

-- BLOCKED_TIMES
CREATE POLICY "blocked_times_select" ON public.blocked_times FOR SELECT USING (true);
CREATE POLICY "blocked_times_insert" ON public.blocked_times FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "blocked_times_delete" ON public.blocked_times FOR DELETE USING (auth.uid() IS NOT NULL);

-- PROFESSIONAL_SERVICES
CREATE POLICY "professional_services_select" ON public.professional_services FOR SELECT USING (true);
CREATE POLICY "professional_services_insert" ON public.professional_services FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "professional_services_delete" ON public.professional_services FOR DELETE USING (auth.uid() IS NOT NULL);

-- PUNCH_CARDS
CREATE POLICY "punch_cards_select" ON public.punch_cards FOR SELECT USING (true);
CREATE POLICY "punch_cards_insert" ON public.punch_cards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "punch_cards_delete" ON public.punch_cards FOR DELETE USING (auth.uid() IS NOT NULL);

-- STYLIST_LEVELS
CREATE POLICY "stylist_levels_select" ON public.stylist_levels FOR SELECT USING (true);

-- WAITING_LIST
CREATE POLICY "waiting_list_select" ON public.waiting_list FOR SELECT USING (true);
CREATE POLICY "waiting_list_insert" ON public.waiting_list FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "waiting_list_delete" ON public.waiting_list FOR DELETE USING (auth.uid() IS NOT NULL);

-- STEP 4: Ensure GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT ON public.companies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_times TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.punch_cards TO authenticated;
GRANT SELECT ON public.stylist_levels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiting_list TO authenticated;

-- STEP 5: Also fix users policies to not depend on SECURITY DEFINER functions
-- Drop ALL user policies and recreate cleanly
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users';
  END LOOP;
END $$;

-- Users: own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users: super admin sees all
CREATE POLICY "users_select_super_admin" ON public.users
  FOR SELECT USING (public.is_super_admin());

-- Users: admin sees same-company users via direct join (no SECURITY DEFINER dependency)
CREATE POLICY "users_select_admin_simple" ON public.users
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = auth.uid()
        AND uc.company_id = users.company_id
    )
  );

-- Users: super admin or own update
CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE USING (public.is_super_admin() OR auth.uid() = id);

-- STEP 6: Also fix user_companies to not depend on user_owns_company
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'user_companies' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.user_companies';
  END LOOP;
END $$;

CREATE POLICY "user_companies_select" ON public.user_companies
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY "user_companies_insert" ON public.user_companies
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY "user_companies_delete" ON public.user_companies
  FOR DELETE USING (
    public.is_super_admin()
    OR user_id = auth.uid()
  );

-- Verify final state
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('companies','plans','services','templates','users','user_companies','customers','appointments','invoices','blocked_times')
ORDER BY tablename, cmd;
