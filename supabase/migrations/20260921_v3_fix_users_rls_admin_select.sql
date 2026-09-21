-- Fix users SELECT/UPDATE RLS for admin: replace user_owns_company() with direct JOIN
-- user_owns_company() returns NULL inside SECURITY DEFINER when called via PostgREST

-- Drop the broken policy
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;

-- SELECT: own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (
    auth.uid() = id
  );

-- SELECT: super admin sees all
CREATE POLICY "users_select_super_admin" ON public.users
  FOR SELECT USING (
    public.is_super_admin()
  );

-- SELECT: admin/profissional sees users from same companies (direct JOIN, no SECURITY DEFINER)
CREATE POLICY "users_select_same_company" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_companies my_uc
      WHERE my_uc.user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.user_companies target_uc
          WHERE target_uc.user_id = users.id
            AND target_uc.company_id = my_uc.company_id
        )
    )
  );

-- UPDATE: super admin or own profile
CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE USING (
    public.is_super_admin()
    OR auth.uid() = id
  );

-- UPDATE: admin can update users from same companies
CREATE POLICY "users_update_same_company" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_companies my_uc
      WHERE my_uc.user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.user_companies target_uc
          WHERE target_uc.user_id = users.id
            AND target_uc.company_id = my_uc.company_id
        )
    )
  );

-- INSERT: allow authenticated (needed for invite flow)
CREATE POLICY "users_insert_authenticated" ON public.users
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );
