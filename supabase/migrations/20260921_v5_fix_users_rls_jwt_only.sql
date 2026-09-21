-- FIX: ALL users RLS policies - avoid is_super_admin() (recursion) and user_owns_company() (returns NULL)
-- Use auth.jwt() for super_admin check, direct JOIN for company check

-- Drop ALL existing policies
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.users';
  END LOOP;
END $$;

-- SELECT: own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- SELECT: super admin sees all (from JWT, no recursion)
CREATE POLICY "users_select_super_admin" ON public.users
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- SELECT: users from same companies see each other
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

-- UPDATE: own profile or super admin (from JWT)
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_update_super_admin" ON public.users
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
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

-- INSERT: allow authenticated (invite flow)
CREATE POLICY "users_insert_authenticated" ON public.users
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
